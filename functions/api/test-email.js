export async function onRequestGet(context) {
  const key = context.env.RESEND_API_KEY;
  const availableEnvKeys = Object.keys(context.env || {});

  if (!key) {
    return Response.json({ error: 'RESEND_API_KEY neni nastaveny', dostupnePromenne: availableEnvKeys });
  }

  // Zkus odeslat testovaci email
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: context.env.FROM_DOMAIN || 'onboarding@resend.dev',
      to: ['robin.petr523@gmail.com'],
      subject: 'Test email z kkoblas',
      html: '<p>Test funguje!</p>'
    })
  });

  const data = await res.json();
  return Response.json({ status: res.status, keyLength: key.length, keyStart: key.slice(0, 6), response: data });
}
