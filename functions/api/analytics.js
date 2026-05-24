const SITE_TAG = '4e27e2346fde40e68f3f03fac3e2c036';

async function gql(apiToken, query) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return res.json();
}

function est(g) {
  return Math.round(g.count * (g.avg?.sampleInterval || 1));
}

export async function onRequestGet(context) {
  const accountId = context.env.CF_ACCOUNT_ID;
  const apiToken  = context.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    return Response.json({ error: 'Chybí CF_ACCOUNT_ID nebo CF_API_TOKEN' }, { status: 503 });
  }

  const fmt   = d => d.toISOString().split('T')[0];
  const end   = new Date();
  const start = new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000);
  const filter = `AND: [{date_geq:"${fmt(start)}"},{date_leq:"${fmt(end)}"},{siteTag:"${SITE_TAG}"}]`;

  try {
    const [r1, r2, r3] = await Promise.all([
      // dotaz 1: po dnech
      gql(apiToken, `{ viewer { accounts(filter:{accountTag:"${accountId}"}) {
        rumPageloadEventsAdaptiveGroups(filter:{${filter}} limit:500 orderBy:[date_ASC]) {
          count avg{sampleInterval} dimensions{date}
        }
      }}}`),
      // dotaz 2: po stránkách
      gql(apiToken, `{ viewer { accounts(filter:{accountTag:"${accountId}"}) {
        rumPageloadEventsAdaptiveGroups(filter:{${filter}} limit:50) {
          count avg{sampleInterval} dimensions{requestPath}
        }
      }}}`),
      // dotaz 3: po zařízení
      gql(apiToken, `{ viewer { accounts(filter:{accountTag:"${accountId}"}) {
        rumPageloadEventsAdaptiveGroups(filter:{${filter}} limit:10) {
          count avg{sampleInterval} dimensions{deviceType}
        }
      }}}`)
    ]);

    // --- zpracování dnů ---
    const groups1 = r1.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];
    const byDate  = {};
    let totalPv   = 0;
    for (const g of groups1) {
      const v = est(g);
      totalPv += v;
      const d = g.dimensions?.date;
      if (d) byDate[d] = (byDate[d] || 0) + v;
    }
    const days = [];
    for (let i = 0; i <= 6; i++) {
      const d  = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
      const ds = fmt(d);
      days.push({ date: ds, count: byDate[ds] || 0 });
    }
    const todayPv = byDate[fmt(end)] || 0;

    // --- zpracování stránek ---
    const groups2  = r2.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];
    const pathMap  = {};
    for (const g of groups2) {
      const path = g.dimensions?.requestPath || '/';
      pathMap[path] = (pathMap[path] || 0) + est(g);
    }
    const topPages = Object.entries(pathMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }));

    // --- zpracování zařízení ---
    const groups3   = r3.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];
    const deviceMap = {};
    for (const g of groups3) {
      const type = g.dimensions?.deviceType || 'Unknown';
      deviceMap[type] = (deviceMap[type] || 0) + est(g);
    }
    const deviceTotal = Object.values(deviceMap).reduce((a, b) => a + b, 0) || 1;
    const devices = Object.entries(deviceMap)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({ type, count, pct: Math.round(count / deviceTotal * 100) }));

    return Response.json({ pageviews: totalPv, todayPv, days, topPages, devices });

  } catch (e) {
    return Response.json({ error: 'Chyba: ' + e.message }, { status: 502 });
  }
}
