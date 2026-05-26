const SITE_TAG = '4e27e2346fde40e68f3f03fac3e2c036';
const GQL_URL  = 'https://api.cloudflare.com/client/v4/graphql';
const CF_API   = 'https://api.cloudflare.com/client/v4';

function fmt(d) { return d.toISOString().split('T')[0]; }
function est(g)  { return Math.round(g.count * ((g.avg && g.avg.sampleInterval) || 1)); }

function cfHeaders(token) {
  return { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };
}

// Najde zone ID domény koblas-nutricni.cz přes REST API
async function findZoneId(token, accountId) {
  const r = await fetch(`${CF_API}/zones?account.id=${accountId}&per_page=50&status=active`, {
    headers: cfHeaders(token)
  });
  if (!r.ok) return null;
  const j = await r.json();
  const zones = j.result || [];
  // Preferuj hlavní doménu, jinak první zónu
  const main = zones.find(z => z.name === 'koblas-nutricni.cz') || zones[0];
  return main ? main.id : null;
}

// GraphQL dotaz — nejdřív zkus zones, pak accounts jako fallback
async function gqlQuery(token, tag, tagType, gqlBody) {
  const r = await fetch(GQL_URL, {
    method: 'POST',
    headers: cfHeaders(token),
    body: JSON.stringify({ query: gqlBody })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (j.errors && j.errors.length) throw new Error(j.errors[0].message);

  const src = j.data && j.data.viewer;
  if (!src) return null;

  const arr = tagType === 'zone'
    ? (src.zones    && src.zones[0])
    : (src.accounts && src.accounts[0]);
  return arr || null;
}

export async function onRequestGet(context) {
  const accountId = context.env.CF_ACCOUNT_ID;
  const token     = context.env.CF_API_TOKEN;
  const url       = new URL(context.request.url);
  const debug     = url.searchParams.get('debug') === '1';

  if (!accountId || !token) {
    return Response.json({
      ok: false,
      error: 'Chybí env vars CF_ACCOUNT_ID nebo CF_API_TOKEN'
    }, { status: 503 });
  }

  const now    = new Date();
  const today  = fmt(now);
  const start7 = fmt(new Date(now.getTime() - 6 * 86400000));

  // Najdi zónu
  const zoneId = await findZoneId(token, accountId);

  if (debug) {
    // Debug: porovnej zone vs account dotazy
    const results = { zoneId, accountId, siteTag: SITE_TAG };

    for (const [label, q] of [
      ['zone_noFilter',   zoneId ? `{viewer{zones(filter:{zoneTag:"${zoneId}"}){rumPageloadEventsAdaptiveGroups(filter:{AND:[{date_geq:"${start7}"},{date_leq:"${today}"}]} limit:5){count avg{sampleInterval}dimensions{date}}}}}` : null],
      ['zone_siteTag',    zoneId ? `{viewer{zones(filter:{zoneTag:"${zoneId}"}){rumPageloadEventsAdaptiveGroups(filter:{AND:[{date_geq:"${start7}"},{date_leq:"${today}"},{siteTag:"${SITE_TAG}"}]} limit:5){count avg{sampleInterval}dimensions{date}}}}}` : null],
      ['account_noFilter',`{viewer{accounts(filter:{accountTag:"${accountId}"}){rumPageloadEventsAdaptiveGroups(filter:{AND:[{date_geq:"${start7}"},{date_leq:"${today}"}]} limit:5){count avg{sampleInterval}dimensions{date}}}}}`],
      ['account_siteTag', `{viewer{accounts(filter:{accountTag:"${accountId}"}){rumPageloadEventsAdaptiveGroups(filter:{AND:[{date_geq:"${start7}"},{date_leq:"${today}"},{siteTag:"${SITE_TAG}"}]} limit:5){count avg{sampleInterval}dimensions{date}}}}}`],
    ]) {
      if (!q) { results[label] = 'skip (no zoneId)'; continue; }
      try {
        const tagType = label.startsWith('zone') ? 'zone' : 'account';
        const tag     = tagType === 'zone' ? zoneId : accountId;
        const r = await gqlQuery(token, tag, tagType, q);
        const groups = r ? (r.rumPageloadEventsAdaptiveGroups || []) : [];
        results[label] = {
          groups: groups.length,
          total:  groups.reduce((s, g) => s + est(g), 0),
          sample: groups.slice(0, 2)
        };
      } catch (e) {
        results[label] = { error: e.message };
      }
    }
    return Response.json({ ok: true, debug: true, results });
  }

  // ── Normální mode ─────────────────────────────────────────────────
  const f7 = `AND:[{date_geq:"${start7}"},{date_leq:"${today}"}]`;
  const fToday = `AND:[{datetime_geq:"${today}T00:00:00Z"},{datetime_leq:"${today}T23:59:59Z"}]`;

  // Sestaví dotazy pro zónu nebo účet
  function makeQueries(tagType, tagVal) {
    const src = tagType === 'zone'
      ? `zones(filter:{zoneTag:"${tagVal}"})`
      : `accounts(filter:{accountTag:"${tagVal}"})`;
    return {
      d7:  `{viewer{${src}{rumPageloadEventsAdaptiveGroups(filter:{${f7}} limit:500 orderBy:[date_ASC]){count avg{sampleInterval}dimensions{date}}}}}`,
      h:   `{viewer{${src}{rumPageloadEventsAdaptiveGroups(filter:{${fToday}} limit:100 orderBy:[datetimeHour_ASC]){count avg{sampleInterval}dimensions{datetimeHour}}}}}`,
      p:   `{viewer{${src}{rumPageloadEventsAdaptiveGroups(filter:{${f7}} limit:50){count avg{sampleInterval}dimensions{requestPath}}}}}`,
      dev: `{viewer{${src}{rumPageloadEventsAdaptiveGroups(filter:{${f7}} limit:10){count avg{sampleInterval}dimensions{deviceType}}}}}`,
    };
  }

  try {
    // Zkus nejdřív zone, pak account
    const attempts = [];
    if (zoneId) attempts.push({ tagType: 'zone',    tagVal: zoneId });
    attempts.push(             { tagType: 'account', tagVal: accountId });

    let r7d, rH, rP, rD, usedMode = 'none';

    for (const { tagType, tagVal } of attempts) {
      const q = makeQueries(tagType, tagVal);
      const test = await gqlQuery(token, tagVal, tagType, q.d7);
      if (!test) continue;
      const groups = test.rumPageloadEventsAdaptiveGroups || [];
      if (groups.length > 0) {
        r7d = test;
        usedMode = tagType;
        [rH, rP, rD] = await Promise.all([
          gqlQuery(token, tagVal, tagType, q.h),
          gqlQuery(token, tagVal, tagType, q.p),
          gqlQuery(token, tagVal, tagType, q.dev),
        ]);
        break;
      }
    }

    // 7 dní
    const byDate = {}; let total = 0;
    for (const g of ((r7d && r7d.rumPageloadEventsAdaptiveGroups) || [])) {
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
    for (const g of ((rH && rH.rumPageloadEventsAdaptiveGroups) || [])) {
      const v = est(g), raw = g.dimensions && g.dimensions.datetimeHour;
      todayPv += v;
      if (raw) { const h = parseInt(raw.slice(11, 13), 10); byHour[h] = (byHour[h] || 0) + v; }
    }
    const hours = [];
    for (let h = 0; h <= 23; h++) hours.push({ hour: h, count: byHour[h] || 0 });

    // Top stránky
    const pathMap = {};
    for (const g of ((rP && rP.rumPageloadEventsAdaptiveGroups) || [])) {
      const p = (g.dimensions && g.dimensions.requestPath) || '/';
      pathMap[p] = (pathMap[p] || 0) + est(g);
    }
    const topPages = Object.entries(pathMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(e => ({ path: e[0], count: e[1] }));

    // Zařízení
    const devMap = {};
    for (const g of ((rD && rD.rumPageloadEventsAdaptiveGroups) || [])) {
      const t = (g.dimensions && g.dimensions.deviceType) || 'Unknown';
      devMap[t] = (devMap[t] || 0) + est(g);
    }
    const devTotal = Object.values(devMap).reduce((a, b) => a + b, 0) || 1;
    const devices = Object.entries(devMap)
      .sort((a, b) => b[1] - a[1])
      .map(e => ({ type: e[0], count: e[1], pct: Math.round(e[1] / devTotal * 100) }));

    const warning = (total === 0)
      ? `Žádná data (mode: ${usedMode}, zoneId: ${zoneId || 'nenalezeno'}) – otevři /api/analytics?debug=1`
      : null;

    return Response.json({ ok: true, pageviews: total, todayPv, days, hours, topPages, devices, warning, usedMode });

  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
