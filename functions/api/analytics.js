const GQL_URL = 'https://api.cloudflare.com/client/v4/graphql';
const CF_API  = 'https://api.cloudflare.com/client/v4';

// Stránky webu – filtr aby se nepočítaly .css/.js/obrázky
const PAGE_PATHS = new Set(['/', '/sluzby.html', '/omne.html', '/jakpracuji.html',
  '/faq.html', '/kontakt.html', '/objednavka.html', '/dekujeme.html', '/cekacka.html']);

function fmt(d) { return d.toISOString().split('T')[0]; }
function est(g)  { return Math.round(g.count * ((g.avg && g.avg.sampleInterval) || 1)); }

function hdr(token) {
  return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
}

async function findZoneId(token, accountId) {
  try {
    const r = await fetch(`${CF_API}/zones?account.id=${accountId}&per_page=50&status=active`, { headers: hdr(token) });
    if (!r.ok) return null;
    const j = await r.json();
    const zones = j.result || [];
    const main = zones.find(z => z.name === 'koblas-nutricni.cz') || zones[0];
    return main ? { id: main.id, name: main.name } : null;
  } catch { return null; }
}

async function gqlZone(token, zoneId, query) {
  const r = await fetch(GQL_URL, {
    method: 'POST',
    headers: hdr(token),
    body: JSON.stringify({ query })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (j.errors && j.errors.length) throw new Error(j.errors[0].message);
  return (j.data && j.data.viewer && j.data.viewer.zones && j.data.viewer.zones[0]) || {};
}

export async function onRequestGet(context) {
  const accountId = context.env.CF_ACCOUNT_ID;
  const token     = context.env.CF_API_TOKEN;
  const isDebug   = new URL(context.request.url).searchParams.get('debug') === '1';

  if (!accountId || !token) {
    return Response.json({ ok: false, error: 'Chybí CF_ACCOUNT_ID nebo CF_API_TOKEN' }, { status: 503 });
  }

  const zone = await findZoneId(token, accountId);
  if (!zone) {
    return Response.json({ ok: false, error: 'Nepodařilo se najít žádnou zónu v CF účtu. Zkontroluj CF_ACCOUNT_ID a token.' }, { status: 503 });
  }

  const now    = new Date();
  const today  = fmt(now);
  const start7 = fmt(new Date(now.getTime() - 6 * 86400000));

  const f7 = `AND:[{date_geq:"${start7}"},{date_leq:"${today}"}]`;
  const fH = `AND:[{datetime_geq:"${today}T00:00:00Z"},{datetime_leq:"${today}T23:59:59Z"}]`;
  const zf = `zoneTag:"${zone.id}"`;

  // Debug mode – ukaž co vrátí různé datasety
  if (isDebug) {
    const tests = {};
    const datasets = ['httpRequestsAdaptiveGroups', 'httpRequests1dGroups', 'httpRequestsOverviewAdaptiveGroups'];
    for (const ds of datasets) {
      try {
        const q = `{viewer{zones(filter:{${zf}}){${ds}(filter:{${f7}} limit:3 orderBy:[date_ASC]){count avg{sampleInterval}dimensions{date}}}}}`;
        const r = await gqlZone(token, zone.id, q);
        const groups = r[ds] || [];
        tests[ds] = { groups: groups.length, total: groups.reduce((s,g) => s+est(g), 0), sample: groups.slice(0,2) };
      } catch(e) { tests[ds] = { error: e.message }; }
    }
    return Response.json({ ok: true, debug: true, zone, tests });
  }

  // ── Hlavní dotazy paralelně ────────────────────────────────────────
  try {
    const [r7d, rH, rP] = await Promise.all([
      // 7 dní – agregace po dnech
      gqlZone(token, zone.id, `{viewer{zones(filter:{${zf}}){httpRequestsAdaptiveGroups(filter:{${f7}} limit:500 orderBy:[date_ASC]){count avg{sampleInterval}dimensions{date}}}}}`),
      // Dnes – agregace po hodinách
      gqlZone(token, zone.id, `{viewer{zones(filter:{${zf}}){httpRequestsAdaptiveGroups(filter:{${fH}} limit:100 orderBy:[datetimeHour_ASC]){count avg{sampleInterval}dimensions{datetimeHour}}}}}`),
      // Top stránky – agregace po cestě
      gqlZone(token, zone.id, `{viewer{zones(filter:{${zf}}){httpRequestsAdaptiveGroups(filter:{${f7}} limit:200){count avg{sampleInterval}dimensions{clientRequestPath}}}}}`)
    ]);

    // 7 dní
    const byDate = {}; let total = 0;
    for (const g of (r7d.httpRequestsAdaptiveGroups || [])) {
      const v = est(g), dd = g.dimensions && g.dimensions.date;
      total += v; if (dd) byDate[dd] = (byDate[dd] || 0) + v;
    }
    const days = [];
    for (let i = 0; i <= 6; i++) {
      const s = fmt(new Date(now.getTime() - (6 - i) * 86400000));
      days.push({ date: s, count: byDate[s] || 0 });
    }

    // Dnes po hodinách
    const byHour = {}; let todayPv = 0;
    for (const g of (rH.httpRequestsAdaptiveGroups || [])) {
      const v = est(g), raw = g.dimensions && g.dimensions.datetimeHour;
      todayPv += v;
      if (raw) { const h = parseInt(raw.slice(11, 13), 10); byHour[h] = (byHour[h] || 0) + v; }
    }
    const hours = [];
    for (let h = 0; h <= 23; h++) hours.push({ hour: h, count: byHour[h] || 0 });

    // Top stránky – filtruj jen HTML stránky, ne assety
    const pathMap = {};
    for (const g of (rP.httpRequestsAdaptiveGroups || [])) {
      const p = (g.dimensions && g.dimensions.clientRequestPath) || '/';
      if (PAGE_PATHS.has(p)) pathMap[p] = (pathMap[p] || 0) + est(g);
    }
    const topPages = Object.entries(pathMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(e => ({ path: e[0], count: e[1] }));

    return Response.json({
      ok: true, pageviews: total, todayPv, days, hours, topPages,
      devices: [],   // httpRequests nemá device dimension – zobrazí se „žádná data"
      _zone: zone.name
    });

  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
