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

  // food slider
  (function () {
    var stage = document.querySelector('.food-slider__stage');
    if (!stage) return;
    var items = Array.from(stage.querySelectorAll('.food-slider__item'));
    if (items.length < 2) return;
    var current = 0;
    items[0].classList.add('is-active');
    setInterval(function () {
      var leaving = current;
      current = (current + 1) % items.length;
      items[leaving].classList.add('is-leaving');
      items[leaving].classList.remove('is-active');
      items[current].classList.add('is-active');
      setTimeout(function () {
        items[leaving].style.transition = 'none';
        items[leaving].classList.remove('is-leaving');
        items[leaving].offsetHeight;
        items[leaving].style.transition = '';
      }, 750);
    }, 4000);
  })();

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
