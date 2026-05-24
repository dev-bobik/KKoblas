var WEB3FORMS_KEY = '962ce707-a0c7-4153-890d-415b6051d67a';

(function () {
  var form      = document.getElementById('cekackaForm');
  var submitBtn = document.getElementById('ckSubmitBtn');
  var errorEl   = document.getElementById('ckError');
  var successEl = document.getElementById('ckSuccess');

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
      var data = new FormData(form);
      data.append('access_key', WEB3FORMS_KEY);
      var res  = await fetch('https://api.web3forms.com/submit', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' }
      });

      if (res.ok) {
        window.location.href = 'index.html';
      } else {
        throw new Error('server error ' + res.status);
      }
    } catch (err) {
      console.error('Web3Forms error:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Chci vědět o volném místě';
      if (errorEl) errorEl.hidden = false;
    }
  });
})();
