(function () {
  var SERVICES   = ['startup', 'mentoring', 'ultimate'];
  var STATUS_KEY = function (s) { return 'kkoblas_status_' + s; };

  // ── Aplikuj stavy ze záložky ─────────────────
  function applyStatuses() {
    var anyPlno = false;

    SERVICES.forEach(function (sluzba) {
      var status = localStorage.getItem(STATUS_KEY(sluzba)) || 'volny';
      var card   = document.querySelector('[data-sluzba="' + sluzba + '"]');
      if (!card) return;

      if (status === 'uzavreny') {
        card.classList.add('plno');
        anyPlno = true;
      } else {
        card.classList.remove('plno');
      }
    });

    // Zobraz waitlist sekci pokud je alespoň jedna služba uzavřená
    var waitlist = document.querySelector('.waitlist');
    if (waitlist) waitlist.style.display = anyPlno ? 'block' : '';
  }

  applyStatuses();

  // Aktualizuj když se změní localStorage (admin v jiné záložce)
  window.addEventListener('storage', function (e) {
    if (e.key && e.key.startsWith('kkoblas_status_')) {
      applyStatuses();
    }
  });

  // ── Smooth scroll pro kotvy ──────────────────
  document.querySelectorAll('a[href="#inbody"], a[href="#waitlist"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // ── Waitlist form ────────────────────────────
  var waitlistForm = document.getElementById('waitlistForm');
  if (waitlistForm) {
    waitlistForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = waitlistForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.textContent = 'Odesílám...';

      try {
        var data = new FormData(waitlistForm);
        // TODO: Nahraď YOUR_WAITLIST_ID skutečným ID z formspree.io
        var res = await fetch('https://formspree.io/f/YOUR_WAITLIST_ID', {
          method: 'POST',
          body: data,
          headers: { Accept: 'application/json' }
        });

        if (res.ok) {
          waitlistForm.querySelectorAll('input, button, fieldset').forEach(function (el) { el.disabled = true; });
          var success = waitlistForm.querySelector('.wl-success');
          if (success) success.hidden = false;
          btn.style.display = 'none';
        } else {
          throw new Error();
        }
      } catch (_) {
        btn.disabled = false;
        btn.textContent = 'Chci vědět o volném místě';
        alert('Formulář se nepodařilo odeslat. Zkuste to znovu nebo mi napište přímo na koblas.nutricni@gmail.com');
      }
    });
  }
})();
