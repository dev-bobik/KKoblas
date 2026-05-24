const SITE_TAG = '4e27e2346fde40e68f3f03fac3e2c036';

export async function onRequestGet(context) {
  const accountId = context.env.CF_ACCOUNT_ID;
  const apiToken  = context.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return Response.json({ error: 'Chybí CF_ACCOUNT_ID nebo CF_API_TOKEN v env vars' }, { status: 503 });
  }

  const fmt = d => d.toISOString().split('T')[0];
  const end   = new Date();
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  const filterBase = `AND: [
    {date_geq: "${fmt(start)}"},
    {date_leq: "${fmt(end)}"},
    {siteTag: "${SITE_TAG}"}
  ]`;

  const query = `{
    viewer {
      accounts(filter: {accountTag: "${accountId}"}) {
        byDate: rumPageloadEventsAdaptiveGroups(
          filter: { ${filterBase} }
          limit: 5000
          orderBy: [date_ASC]
        ) {
          count
          avg { sampleInterval }
          dimensions { date }
        }
        byPath: rumPageloadEventsAdaptiveGroups(
          filter: { ${filterBase} }
          limit: 10
          orderBy: [count_DESC]
        ) {
          count
          avg { sampleInterval }
          dimensions { requestPath }
        }
        byDevice: rumPageloadEventsAdaptiveGroups(
          filter: { ${filterBase} }
          limit: 10
          orderBy: [count_DESC]
        ) {
          count
          avg { sampleInterval }
          dimensions { deviceType }
        }
      }
    }
  }`;

  let res;
  try {
    res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });
  } catch (e) {
    return Response.json({ error: 'Síťová chyba: ' + e.message }, { status: 502 });
  }

  const json = await res.json();

  if (!res.ok || json.errors) {
    const msg = json.errors?.[0]?.message || ('HTTP ' + res.status);
    return Response.json({ error: 'Cloudflare API: ' + msg }, { status: 502 });
  }

  const acc = json.data?.viewer?.accounts?.[0] || {};

  // --- by date ---
  const byDateGroups = acc.byDate || [];
  const byDate = {};
  let totalPv = 0;
  for (const g of byDateGroups) {
    const est = Math.round(g.count * (g.avg?.sampleInterval || 1));
    totalPv += est;
    const d = g.dimensions?.date;
    if (d) byDate[d] = (byDate[d] || 0) + est;
  }
  const days = [];
  for (let i = 0; i <= 6; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const ds = fmt(d);
    days.push({ date: ds, count: byDate[ds] || 0 });
  }
  const todayStr = fmt(end);
  const todayPv  = byDate[todayStr] || 0;

  // --- by path ---
  const pathMap = {};
  for (const g of (acc.byPath || [])) {
    const est  = Math.round(g.count * (g.avg?.sampleInterval || 1));
    const path = g.dimensions?.requestPath || '/';
    pathMap[path] = (pathMap[path] || 0) + est;
  }
  const topPages = Object.entries(pathMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([path, count]) => ({ path, count }));

  // --- by device ---
  const deviceMap = {};
  for (const g of (acc.byDevice || [])) {
    const est    = Math.round(g.count * (g.avg?.sampleInterval || 1));
    const device = g.dimensions?.deviceType || 'Unknown';
    deviceMap[device] = (deviceMap[device] || 0) + est;
  }
  const deviceTotal = Object.values(deviceMap).reduce((a, b) => a + b, 0) || 1;
  const devices = Object.entries(deviceMap)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count, pct: Math.round(count / deviceTotal * 100) }));

  return Response.json({ pageviews: totalPv, todayPv, days, topPages, devices });
}
