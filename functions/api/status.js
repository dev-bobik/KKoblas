const DEFAULT = {
  startup: 'volny', mentoring: 'volny', ultimate: 'volny',
  event: { active: false, name: '', popis: '', cena: '', odkaz: '' },
  prices: {
    startup:  { jednorizove: '6 900 Kč' },
    mentoring: { jednorizove: '14 700 Kč', splatky: '7 500 Kč (1. splátka)' },
    ultimate:  { jednorizove: '22 300 Kč', splatky: '11 900 Kč (1. splátka)' }
  }
};

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
    const DEF_P = DEFAULT.prices;
    const status = {
      startup:   allowed.includes(body.startup)   ? body.startup   : 'volny',
      mentoring: allowed.includes(body.mentoring) ? body.mentoring : 'volny',
      ultimate:  allowed.includes(body.ultimate)  ? body.ultimate  : 'volny',
      event: {
        active: body.event?.active === true,
        name:   (body.event?.name  || '').slice(0, 120),
        popis:  (body.event?.popis || '').slice(0, 500),
        cena:   (body.event?.cena  || '').slice(0, 80),
        odkaz:  (body.event?.odkaz || '').slice(0, 300)
      },
      prices: {
        startup: {
          jednorizove: String(body.prices?.startup?.jednorizove || DEF_P.startup.jednorizove).slice(0, 80),
          inbodyNote:  String(body.prices?.startup?.inbodyNote  || '').slice(0, 200),
          splatkyLink: String(body.prices?.startup?.splatkyLink || '').slice(0, 200)
        },
        mentoring: {
          jednorizove: String(body.prices?.mentoring?.jednorizove || DEF_P.mentoring.jednorizove).slice(0, 80),
          splatky:     String(body.prices?.mentoring?.splatky     || DEF_P.mentoring.splatky).slice(0, 120),
          splatkyNote: String(body.prices?.mentoring?.splatkyNote || '').slice(0, 300),
          inbodyNote:  String(body.prices?.mentoring?.inbodyNote  || '').slice(0, 200),
          splatkyLink: String(body.prices?.mentoring?.splatkyLink || '').slice(0, 200)
        },
        ultimate: {
          jednorizove: String(body.prices?.ultimate?.jednorizove || DEF_P.ultimate.jednorizove).slice(0, 80),
          splatky:     String(body.prices?.ultimate?.splatky     || DEF_P.ultimate.splatky).slice(0, 120),
          splatkyNote: String(body.prices?.ultimate?.splatkyNote || '').slice(0, 300),
          inbodyNote:  String(body.prices?.ultimate?.inbodyNote  || '').slice(0, 200),
          splatkyLink: String(body.prices?.ultimate?.splatkyLink || '').slice(0, 200)
        }
      }
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
