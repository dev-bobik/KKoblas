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

  var nameEl  = document.getElementById('orderServiceName');
  var platbaEl = document.getElementById('orderPlatba');
  var priceEl  = document.getElementById('orderPrice');

  if (nameEl)  nameEl.textContent  = svc.label;
  if (platbaEl) platbaEl.textContent = info.platba;
  if (priceEl)  priceEl.textContent  = info.price;

  var hSluzba = document.getElementById('hiddenSluzba');
  var hPlatba = document.getElementById('hiddenPlatba');
  var hPrice  = document.getElementById('hiddenPrice');
  var hSubj   = document.getElementById('emailSubject');

  if (hSluzba) hSluzba.value = svc.label;
  if (hPlatba) hPlatba.value = info.platba;
  if (hPrice)  hPrice.value  = info.price;
  if (hSubj)   hSubj.value   = 'Nová objednávka – ' + svc.label;

  var form      = document.getElementById('orderForm');
  var submitBtn = document.getElementById('submitBtn');
  var errorEl   = document.getElementById('formError');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Odesílám...';
    if (errorEl) errorEl.hidden = true;

    try {
      var formData = new FormData(form);
      var payload  = {};
      formData.forEach(function (val, key) { payload[key] = val; });

      var response = await fetch('/api/objednavka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });

      var result = await response.json();
      if (response.ok && result.ok) {
        var name  = form.querySelector('[name="Jmeno"]').value;
        var email = form.querySelector('[name="Email"]').value;
        var dest  = 'dekujeme.html?sluzba=' + encodeURIComponent(svc.label)
                  + '&jmeno=' + encodeURIComponent(name)
                  + '&email=' + encodeURIComponent(email);
        window.location.href = dest;
      } else {
        throw new Error(result.error || 'Server error');
      }
    } catch (_) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ZÁVAZNĚ ODESLAT ŽÁDOST O SLUŽBU';
      if (errorEl) errorEl.hidden = false;
    }
  });
})();
