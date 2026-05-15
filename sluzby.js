(function () {
  var SERVICES = ['startup', 'mentoring', 'ultimate'];

  function applyStatuses(data) {
    SERVICES.forEach(function (sluzba) {
      var status = (data && data[sluzba]) || 'volny';
      var card   = document.querySelector('[data-sluzba="' + sluzba + '"]');
      if (!card) return;
      card.classList.toggle('plno', status === 'uzavreny');
    });
  }

  fetch('/api/status')
    .then(function (r) { return r.json(); })
    .then(applyStatuses)
    .catch(function () {
      // fallback pro lokální vývoj
      fetch('status.json?_=' + Date.now())
        .then(function (r) { return r.json(); })
        .then(applyStatuses)
        .catch(function () { applyStatuses({}); });
    });

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
