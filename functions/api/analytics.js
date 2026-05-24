const SITE_TAG   = '4e27e2346fde40e68f3f03fac3e2c036';
const GQL_URL    = 'https://api.cloudflare.com/client/v4/graphql';

async function query(token, accountId, q) {
  const r = await fetch(GQL_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q })
  });
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0].message);
  return j.data.viewer.accounts[0];
}

function fmt(d) { return d.toISOString().split('T')[0]; }
function est(g)  { return Math.round(g.count * ((g.avg && g.avg.sampleInterval) || 1)); }

export async function onRequestGet(context) {
  const accountId = context.env.CF_ACCOUNT_ID;
  const token     = context.env.CF_API_TOKEN;

  if (!accountId || !token) {
    return Response.json({ ok: false, error: 'Chybí env vars CF_ACCOUNT_ID nebo CF_API_TOKEN' }, { status: 503 });
  }

  const now    = new Date();
  const today  = fmt(now);
  const start7 = fmt(new Date(now.getTime() - 6 * 86400000));
  const baseFilter = 'AND:[{date_geq:"' + start7 + '"},{date_leq:"' + today + '"},{siteTag:"' + SITE_TAG + '"}]';
  const todayStart = today + 'T00:00:00Z';
  const todayEnd   = today + 'T23:59:59Z';

  try {
    // Dotaz 1: 7 dní po dnech
    const acc7 = await query(token, accountId, `{viewer{accounts(filter:{accountTag:"${accountId}"}){
      rumPageloadEventsAdaptiveGroups(filter:{${baseFilter}} limit:500 orderBy:[date_ASC]){
        count avg{sampleInterval} dimensions{date}
      }
    }}}`);

    const byDate = {};
    let total = 0;
    for (const g of (acc7.rumPageloadEventsAdaptiveGroups || [])) {
      const v = est(g), dd = g.dimensions && g.dimensions.date;
      total += v;
      if (dd) byDate[dd] = (byDate[dd] || 0) + v;
    }
    const days = [];
    for (let i = 0; i <= 6; i++) {
      const d = new Date(now.getTime() - (6 - i) * 86400000);
      const s = fmt(d);
      days.push({ date: s, count: byDate[s] || 0 });
    }

    // Dotaz 2: dnes po hodinách
    const accH = await query(token, accountId, `{viewer{accounts(filter:{accountTag:"${accountId}"}){
      rumPageloadEventsAdaptiveGroups(
        filter:{AND:[{datetime_geq:"${todayStart}"},{datetime_leq:"${todayEnd}"},{siteTag:"${SITE_TAG}"}]}
        limit:100 orderBy:[datetimeHour_ASC]
      ){count avg{sampleInterval} dimensions{datetimeHour}}
    }}}`);

    const byHour = {};
    let todayPv = 0;
    for (const g of (accH.rumPageloadEventsAdaptiveGroups || [])) {
      const v = est(g);
      todayPv += v;
      const raw = g.dimensions && g.dimensions.datetimeHour;
      if (raw) {
        const h = parseInt(raw.slice(11, 13), 10);
        byHour[h] = (byHour[h] || 0) + v;
      }
    }
    const hours = [];
    for (let h = 0; h <= 23; h++) hours.push({ hour: h, count: byHour[h] || 0 });

    // Dotaz 3: top stránky
    const accP = await query(token, accountId, `{viewer{accounts(filter:{accountTag:"${accountId}"}){
      rumPageloadEventsAdaptiveGroups(filter:{${baseFilter}} limit:50){
        count avg{sampleInterval} dimensions{requestPath}
      }
    }}}`);

    const pathMap = {};
    for (const g of (accP.rumPageloadEventsAdaptiveGroups || [])) {
      const path = (g.dimensions && g.dimensions.requestPath) || '/';
      pathMap[path] = (pathMap[path] || 0) + est(g);
    }
    const topPages = Object.entries(pathMap)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, 5)
      .map(function(e) { return { path: e[0], count: e[1] }; });

    // Dotaz 4: zařízení
    const accD = await query(token, accountId, `{viewer{accounts(filter:{accountTag:"${accountId}"}){
      rumPageloadEventsAdaptiveGroups(filter:{${baseFilter}} limit:10){
        count avg{sampleInterval} dimensions{deviceType}
      }
    }}}`);

    const devMap = {};
    for (const g of (accD.rumPageloadEventsAdaptiveGroups || [])) {
      const t = (g.dimensions && g.dimensions.deviceType) || 'Unknown';
      devMap[t] = (devMap[t] || 0) + est(g);
    }
    const devTotal = Object.values(devMap).reduce(function(a, b) { return a + b; }, 0) || 1;
    const devices = Object.entries(devMap)
      .sort(function(a, b) { return b[1] - a[1]; })
      .map(function(e) { return { type: e[0], count: e[1], pct: Math.round(e[1] / devTotal * 100) }; });

    return Response.json({ ok: true, pageviews: total, todayPv, days, hours, topPages, devices });

  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
