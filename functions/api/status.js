const DEFAULT = { startup: 'volny', mentoring: 'volny', ultimate: 'volny' };

export async function onRequestGet(context) {
  try {
    const raw  = await context.env.STATUS_STORE.get('status');
    const data = raw || JSON.stringify(DEFAULT);
    return new Response(data, {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch {
    return new Response(JSON.stringify(DEFAULT), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const PASS = context.env.ADMIN_PASS || 'koblas123';
    if (body.password !== PASS) {
      return new Response('Unauthorized', { status: 401 });
    }
    const allowed = ['volny', 'uzavreny'];
    const status = {
      startup:   allowed.includes(body.startup)   ? body.startup   : 'volny',
      mentoring: allowed.includes(body.mentoring) ? body.mentoring : 'volny',
      ultimate:  allowed.includes(body.ultimate)  ? body.ultimate  : 'volny'
    };
    await context.env.STATUS_STORE.put('status', JSON.stringify(status));
    return new Response(JSON.stringify({ ok: true, status }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
