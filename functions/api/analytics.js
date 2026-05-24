const SITE_TAG = '4e27e2346fde40e68f3f03fac3e2c036';

async function gql(apiToken, query) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return res.json();
}

function est(g) { return Math.round(g.count * (g.avg?.sampleInterval || 1)); }

export async function onRequestGet(context) {
  const accountId = context.env.CF_ACCOUNT_ID;
  const apiToken  = context.env.CF_API_TOKEN;
  if (!accountId || !apiToken) {
    return Response.json({ error: 'Chybí CF_ACCOUNT_ID nebo CF_API_TOKEN' }, { status: 503 });
  }

  const fmt  = d => d.toISOString().split('T')[0];
  const now  = new Date();
  const todayStr  = fmt(now);
  const startStr  = fmt(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  const todayStart = todayStr + 'T00:00:00Z';
  const todayEnd   = todayStr + 'T23:59:59Z';

  try {
    const [r7d, rToday, rPath, rDevice] = await Promise.all([
      // 7 dní - po dnech
      gql(apiToken, `{ viewer { accounts(filter:{accountTag:"${accountId}"}) {
        rumPageloadEventsAdaptiveGroups(
          filter:{AND:[{date_geq:"${startStr}"},{date_leq:"${todayStr}"},{siteTag:"${SITE_TAG}"}]}
          limit:500 orderBy:[date_ASC]
        ) { count avg{sampleInterval} dimensions{date} }
      }}}`),
      // dnes - po hodinách
      gql(apiToken, `{ viewer { accounts(filter:{accountTag:"${accountId}"}) {
        rumPageloadEventsAdaptiveGroups(
          filter:{AND:[{datetime_geq:"${todayStart}"},{datetime_leq:"${todayEnd}"},{siteTag:"${SITE_TAG}"}]}
          limit:100 orderBy:[datetimeHour_ASC]
        ) { count avg{sampleInterval} dimensions{datetimeHour} }
      }}}`),
      // top stránky
      gql(apiToken, `{ viewer { accounts(filter:{accountTag:"${accountId}"}) {
        rumPageloadEventsAdaptiveGroups(
          filter:{AND:[{date_geq:"${startStr}"},{date_leq:"${todayStr}"},{siteTag:"${SITE_TAG}"}]}
          limit:50
        ) { count avg{sampleInterval} dimensions{requestPath} }
      }}}`),
      // zařízení
      gql(apiToken, `{ viewer { accounts(filter:{accountTag:"${accountId}"}) {
        rumPageloadEventsAdaptiveGroups(
          filter:{AND:[{date_geq:"${startStr}"},{date_leq:"${todayStr}"},{siteTag:"${SITE_TAG}"}]}
          limit:10
        ) { count avg{sampleInterval} dimensions{deviceType} }
      }}}`)
    ]);

    // --- 7 dní ---
    const byDate = {};
    let totalPv  = 0;
    for (const g of r7d.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || []) {
      const v = est(g), d = g.dimensions?.date;
      totalPv += v;
      if (d) byDate[d] = (byDate[d] || 0) + v;
    }
    const days = [];
    for (let i = 0; i <= 6; i++) {
      const d  = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
      const ds = fmt(d);
      days.push({ date: ds, count: byDate[ds] || 0 });
    }

    // --- dnes po hodinách ---
    const byHour = {};
    let todayPv  = 0;
    for (const g of rToday.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || []) {
      const v = est(g);
      todayPv += v;
      // datetimeHour format: "2024-05-24T14:00:00Z" → extract hour
      const raw = g.dimensions?.datetimeHour || '';
      const h   = raw ? parseInt(raw.slice(11, 13), 10) : -1;
      if (h >= 0) byHour[h] = (byHour[h] || 0) + v;
    }
    const hours = [];
    for (let h = 0; h <= 23; h++) {
      hours.push({ hour: h, count: byHour[h] || 0 });
    }

    // --- top stránky ---
    const pathMap = {};
    for (const g of rPath.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || []) {
      const path = g.dimensions?.requestPath || '/';
      pathMap[path] = (pathMap[path] || 0) + est(g);
    }
    const topPages = Object.entries(pathMap).sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([path, count]) => ({ path, count }));

    // --- zařízení ---
    const deviceMap = {};
    for (const g of rDevice.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || []) {
      const type = g.dimensions?.deviceType || 'Unknown';
      deviceMap[type] = (deviceMap[type] || 0) + est(g);
    }
    const deviceTotal = Object.values(deviceMap).reduce((a, b) => a + b, 0) || 1;
    const devices = Object.entries(deviceMap).sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, pct: Math.round(count / deviceTotal * 100) }));

    return Response.json({ pageviews: totalPv, todayPv, days, hours, topPages, devices });

  } catch (e) {
    return Response.json({ error: 'Chyba: ' + e.message }, { status: 502 });
  }
}
