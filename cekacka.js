(function () {
  var form      = document.getElementById('cekackaForm');
  var submitBtn = document.getElementById('ckSubmitBtn');
  var errorEl   = document.getElementById('ckError');

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
      var zajem = Array.from(form.querySelectorAll('[name="Zajem"]:checked'))
                       .map(function (el) { return el.value; });

      var payload = {
        Jmeno:   form.querySelector('[name="Jmeno"]').value.trim(),
        Email:   form.querySelector('[name="Email"]').value.trim(),
        Telefon: form.querySelector('[name="Telefon"]').value.trim(),
        Zajem:   zajem
      };

      var res = await fetch('/api/cekacka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload)
      });

      var result = await res.json();
      if (res.ok && result.ok) {
        window.location.href = 'index.html';
      } else {
        throw new Error(result.error || 'Server error ' + res.status);
      }
    } catch (err) {
      console.error('Cekacka error:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Chci vědět o volném místě';
      if (errorEl) errorEl.hidden = false;
    }
  });
})();
