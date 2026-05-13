/**
 * Formspree setup:
 * 1. formspree.io → "+ New Form" → pojmenuj "KKoblas Cekacka"
 * 2. Zkopíruj ID a vlož níže místo YOUR_WAITLIST_ID
 */
var FORMSPREE_ID = 'YOUR_WAITLIST_ID';

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
      var res  = await fetch('https://formspree.io/f/' + FORMSPREE_ID, {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' }
      });

      if (res.ok) {
        form.hidden = true;
        if (successEl) successEl.hidden = false;
      } else {
        throw new Error();
      }
    } catch (_) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Chci vědět o volném místě';
      if (errorEl) errorEl.hidden = false;
    }
  });
})();
