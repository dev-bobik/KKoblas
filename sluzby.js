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

  // ── Smooth scroll pro #inbody kotvu ─────────
  document.querySelectorAll('a[href="#inbody"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var target = document.getElementById('inbody');
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
})();
