const SITE_TAG = '4e27e2346fde40e68f3f03fac3e2c036';
const GQL_URL  = 'https://api.cloudflare.com/client/v4/graphql';

function fmt(d) { return d.toISOString().split('T')[0]; }
function est(g)  { return Math.round(g.count * ((g.avg && g.avg.sampleInterval) || 1)); }

async function gql(token, accountId, body) {
  const r = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: body })
  });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' – neplatný token nebo oprávnění');
  const j = await r.json();
  if (j.errors && j.errors.length) throw new Error(j.errors[0].message);
  const accounts = j.data && j.data.viewer && j.data.viewer.accounts;
  // Vrátí { _accountFound: false } pokud CF_ACCOUNT_ID nesedí s tokenem
  if (!accounts || accounts.length === 0) return { _accountFound: false };
  return Object.assign({ _accountFound: true }, accounts[0]);
}

export async function onRequestGet(context) {
  const accountId = context.env.CF_ACCOUNT_ID;
  const token     = context.env.CF_API_TOKEN;

  if (!accountId || !token) {
    return Response.json({
      ok: false,
      error: 'Chybí env vars CF_ACCOUNT_ID nebo CF_API_TOKEN – nastav je v Cloudflare Pages → Settings → Environment variables'
    }, { status: 503 });
  }

  const now    = new Date();
  const today  = fmt(now);
  const start7 = fmt(new Date(now.getTime() - 6 * 86400000));
  const f7     = `AND:[{date_geq:"${start7}"},{date_leq:"${today}"},{siteTag:"${SITE_TAG}"}]`;
  const fToday = `AND:[{datetime_geq:"${today}T00:00:00Z"},{datetime_leq:"${today}T23:59:59Z"},{siteTag:"${SITE_TAG}"}]`;

  try {
    // Všechny 4 dotazy paralelně
    const [r7d, rH, rP, rD] = await Promise.all([
      gql(token, accountId, `{viewer{accounts(filter:{accountTag:"${accountId}"}){rumPageloadEventsAdaptiveGroups(filter:{${f7}} limit:500 orderBy:[date_ASC]){count avg{sampleInterval}dimensions{date}}}}}`),
      gql(token, accountId, `{viewer{accounts(filter:{accountTag:"${accountId}"}){rumPageloadEventsAdaptiveGroups(filter:{${fToday}} limit:100 orderBy:[datetimeHour_ASC]){count avg{sampleInterval}dimensions{datetimeHour}}}}}`),
      gql(token, accountId, `{viewer{accounts(filter:{accountTag:"${accountId}"}){rumPageloadEventsAdaptiveGroups(filter:{${f7}} limit:50){count avg{sampleInterval}dimensions{requestPath}}}}}`),
      gql(token, accountId, `{viewer{accounts(filter:{accountTag:"${accountId}"}){rumPageloadEventsAdaptiveGroups(filter:{${f7}} limit:10){count avg{sampleInterval}dimensions{deviceType}}}}}`)
    ]);

    // Kontrola jestli byl nalezen účet – nejčastější příčina nulových dat
    if (!r7d._accountFound) {
      return Response.json({
        ok: false,
        error: 'CF_ACCOUNT_ID nesedí s tímto API tokenem – zkontroluj Account ID v Cloudflare dashboard (pravý horní roh → URL obsahuje /accounts/TOTO_JE_ID)'
      }, { status: 403 });
    }

    // 7 dní
    const byDate = {}; let total = 0;
    for (const g of (r7d.rumPageloadEventsAdaptiveGroups || [])) {
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
    for (const g of (rH.rumPageloadEventsAdaptiveGroups || [])) {
      const v = est(g), raw = g.dimensions && g.dimensions.datetimeHour;
      todayPv += v;
      if (raw) { const h = parseInt(raw.slice(11, 13), 10); byHour[h] = (byHour[h] || 0) + v; }
    }
    const hours = [];
    for (let h = 0; h <= 23; h++) hours.push({ hour: h, count: byHour[h] || 0 });

    // Top stránky
    const pathMap = {};
    for (const g of (rP.rumPageloadEventsAdaptiveGroups || [])) {
      const p = (g.dimensions && g.dimensions.requestPath) || '/';
      pathMap[p] = (pathMap[p] || 0) + est(g);
    }
    const topPages = Object.entries(pathMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => ({ path: e[0], count: e[1] }));

    // Zařízení
    const devMap = {};
    for (const g of (rD.rumPageloadEventsAdaptiveGroups || [])) {
      const t = (g.dimensions && g.dimensions.deviceType) || 'Unknown';
      devMap[t] = (devMap[t] || 0) + est(g);
    }
    const devTotal = Object.values(devMap).reduce((a, b) => a + b, 0) || 1;
    const devices = Object.entries(devMap).sort((a, b) => b[1] - a[1]).map(e => ({ type: e[0], count: e[1], pct: Math.round(e[1] / devTotal * 100) }));

    // Varování když jsou data nulová ale účet byl nalezen
    const warning = (total === 0 && topPages.length === 0)
      ? 'Účet nalezen, ale žádná data. Zkontroluj: 1) Web Analytics je aktivní pro tento web v CF dashboardu, 2) token má scope "Account Analytics: Read"'
      : null;

    return Response.json({ ok: true, pageviews: total, todayPv, days, hours, topPages, devices, warning });

  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
