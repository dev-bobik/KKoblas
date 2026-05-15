/**
 * ══════════════════════════════════════════════════
 *  NASTAVENÍ E-MAILU – Formspree
 * ══════════════════════════════════════════════════
 *  1. Jdi na https://formspree.io a založ účet (zadej koblas.nutricni@gmail.com)
 *  2. Klikni na "+ New Form", pojmenuj ho "KKoblas Objednavky"
 *  3. Zkopíruj ID z URL (vypadá jako: xyzabcde)
 *  4. Vlož ho do proměnné FORMSPREE_ID níže
 *  5. Hotovo – formulář bude chodit na koblas.nutricni@gmail.com
 * ══════════════════════════════════════════════════
 */
var WEB3FORMS_KEY = '962ce707-a0c7-4153-890d-415b6051d67a';

// Mapování URL parametrů na zobrazovaná data
var serviceMap = {
  startup: {
    label: 'START-UP – Profi odrazový můstek',
    jednorizove: { platba: 'Jednorázová platba', price: '6 900 Kč' },
    splatky:     { platba: 'Jednorázová platba', price: '6 900 Kč' }
  },
  mentoring: {
    label: 'MENTORING – Individuální vedení',
    jednorizove: { platba: 'Jednorázová platba', price: '15 900 Kč' },
    splatky:     { platba: 'Splátkový kalendář', price: '7 500 Kč (1. splátka)' }
  },
  ultimate: {
    label: 'ULTIMATE – Maximální výkon a biohacking',
    jednorizove: { platba: 'Jednorázová platba', price: '23 900 Kč' },
    splatky:     { platba: 'Splátkový kalendář', price: '11 900 Kč (1. splátka)' }
  }
};

(function () {
  var params  = new URLSearchParams(location.search);
  var sluzba  = params.get('sluzba') || 'startup';
  var platba  = params.get('platba') || 'jednorizove';

  var svc  = serviceMap[sluzba] || serviceMap.startup;
  var info = svc[platba] || svc.jednorizove;

  // Vyplň shrnutí objednávky
  var nameEl  = document.getElementById('orderServiceName');
  var platbaEl = document.getElementById('orderPlatba');
  var priceEl  = document.getElementById('orderPrice');

  if (nameEl)  nameEl.textContent  = svc.label;
  if (platbaEl) platbaEl.textContent = info.platba;
  if (priceEl)  priceEl.textContent  = info.price;

  // Vyplň skrytá pole do formuláře
  var hSluzba = document.getElementById('hiddenSluzba');
  var hPlatba = document.getElementById('hiddenPlatba');
  var hPrice  = document.getElementById('hiddenPrice');
  var hSubj   = document.getElementById('emailSubject');

  if (hSluzba) hSluzba.value = svc.label;
  if (hPlatba) hPlatba.value = info.platba;
  if (hPrice)  hPrice.value  = info.price;
  if (hSubj)   hSubj.value   = 'Nová objednávka – ' + svc.label;

  // ── Odeslání formuláře ────────────────────────
  var form      = document.getElementById('orderForm');
  var submitBtn = document.getElementById('submitBtn');
  var errorEl   = document.getElementById('formError');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    // Nativní validace
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílám...';
    if (errorEl) errorEl.hidden = true;

    try {
      var formData = new FormData(form);
      formData.append('access_key', WEB3FORMS_KEY);
      var response = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' }
      });

      if (response.ok) {
        // Předáme jméno a e-mail na potvrzovací stránku
        var name  = form.querySelector('[name="Jmeno"]').value;
        var email = form.querySelector('[name="Email"]').value;
        var dest  = 'dekujeme.html?sluzba=' + encodeURIComponent(svc.label)
                  + '&jmeno=' + encodeURIComponent(name)
                  + '&email=' + encodeURIComponent(email);
        window.location.href = dest;
      } else {
        throw new Error('Server error');
      }
    } catch (_) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ZÁVAZNĚ ODESLAT ŽÁDOST O SLUŽBU';
      if (errorEl) errorEl.hidden = false;
    }
  });
})();
