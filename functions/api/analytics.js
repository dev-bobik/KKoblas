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

  const query = `{
    viewer {
      accounts(filter: {accountTag: "${accountId}"}) {
        rumPageloadEventsAdaptiveGroups(
          filter: {
            AND: [
              {date_geq: "${fmt(start)}"},
              {date_leq: "${fmt(end)}"},
              {siteTag: "${SITE_TAG}"}
            ]
          }
          limit: 5000
          orderBy: [date_ASC]
        ) {
          count
          avg { sampleInterval }
          dimensions { date }
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

  const groups = json.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups || [];

  const byDate = {};
  let totalPv = 0;

  for (const g of groups) {
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

  return Response.json({ pageviews: totalPv, days });
}
