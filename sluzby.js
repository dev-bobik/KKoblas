(function () {
  var SERVICES = ['startup', 'mentoring', 'ultimate'];

  function applyStatuses(data) {
    SERVICES.forEach(function (sluzba) {
      var status = (data && data[sluzba]) || 'volny';
      var card   = document.querySelector('[data-sluzba="' + sluzba + '"]');
      if (!card) return;
      card.classList.toggle('plno', status === 'uzavreny');
    });
    applyEvent(data && data.event);
  }

  function applyEvent(ev) {
    var banner  = document.getElementById('eventBanner');
    if (!banner) return;
    if (!ev || !ev.active) { banner.hidden = true; return; }
    banner.hidden = false;
    var nameEl      = document.getElementById('eventBannerName');
    var opisEl      = document.getElementById('eventBannerPopis');
    var cenaEl      = document.getElementById('eventBannerCena');
    var objednatEl  = document.getElementById('eventBannerObjednat');
    var odkazEl     = document.getElementById('eventBannerOdkaz');
    if (nameEl)     nameEl.textContent = ev.name  || '';
    if (opisEl)     opisEl.textContent = ev.popis || '';
    if (cenaEl) {
      if (ev.cena) { cenaEl.textContent = ev.cena; cenaEl.hidden = false; }
      else { cenaEl.hidden = true; }
    }
    if (objednatEl) objednatEl.hidden = false;
    if (odkazEl) {
      if (ev.odkaz) { odkazEl.href = ev.odkaz; odkazEl.hidden = false; }
      else { odkazEl.hidden = true; }
    }
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

    var cur  = 0;
    var prev = items.length - 1;
    var next = 1 % items.length;

    items[cur].classList.add('is-active');
    items[prev].classList.add('is-prev');
    items[next].classList.add('is-next');

    setInterval(function () {
      var oldPrev = prev;
      prev = cur;
      cur  = next;
      next = (cur + 1) % items.length;

      // old-prev animuje doleva ven, pak se potichu přesune doprava
      items[oldPrev].classList.remove('is-prev');
      items[oldPrev].classList.add('is-exiting');
      setTimeout(function () {
        items[oldPrev].style.transition = 'none';
        items[oldPrev].classList.remove('is-exiting');
        items[oldPrev].offsetHeight;
        items[oldPrev].style.transition = '';
      }, 750);

      // aktivní → levý peek
      items[prev].classList.remove('is-active');
      items[prev].classList.add('is-prev');

      // pravý peek → aktivní
      items[cur].classList.remove('is-next');
      items[cur].classList.add('is-active');

      // připrav nový pravý peek
      items[next].classList.add('is-next');
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
