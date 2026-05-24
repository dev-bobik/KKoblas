var SESSION_KEY  = 'kkoblas_admin_session';
var ENTERED_PASS = '';
var SERVICES     = ['startup', 'mentoring', 'ultimate'];

var lockScreen = document.getElementById('lockScreen');
var consolEl   = document.getElementById('consolEl');
var lockForm   = document.getElementById('lockForm');
var lockInput  = document.getElementById('lockInput');
var lockError  = document.getElementById('lockError');
var deployBar  = document.getElementById('deployBar');
var deployMsg  = document.getElementById('deployMsg');

var currentStatus = { startup: 'volny', mentoring: 'volny', ultimate: 'volny', event: { active: false, name: '', popis: '', odkaz: '' } };

// ── Auth ─────────────────────────────────────────
function unlock() {
  lockScreen.style.display = 'none';
  consolEl.hidden = false;
  sessionStorage.setItem(SESSION_KEY, '1');
  loadStatus();
  loadAnalytics();
}

if (sessionStorage.getItem(SESSION_KEY) === '1') unlock();

lockForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  var typed = lockInput.value;
  try {
    var getRes  = await fetch('/api/status');
    var current = await getRes.json();
    var postRes = await fetch('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ password: typed }, current))
    });
    var data = await postRes.json();
    if (postRes.ok && data.ok) {
      ENTERED_PASS = typed;
      currentStatus = data.status;
      unlock();
    } else {
      lockInput.value = '';
      lockError.hidden = false;
      lockError.style.animation = 'none';
      void lockError.offsetWidth;
      lockError.style.animation = 'shake .3s ease';
    }
  } catch {
    lockInput.value = '';
    lockError.hidden = false;
  }
});

// ── API ───────────────────────────────────────────
async function loadStatus() {
  setDeploy('Načítám stav...', 'loading');
  try {
    var res  = await fetch('/api/status');
    var data = await res.json();
    currentStatus = data;
    renderAll();
    deployBar.hidden = true;
  } catch {
    setDeploy('Chyba načítání — funguje jen na živém webu', 'error');
    renderAll();
  }
}

async function saveStatus() {
  setDeploy('⚡ Ukládám...', 'loading');
  try {
    var res = await fetch('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({ password: ENTERED_PASS }, currentStatus))
    });
    if (!res.ok) throw new Error(res.status);
    setDeploy('✓ Uloženo — změna je okamžitě živá', 'ok');
    setTimeout(function () { deployBar.hidden = true; }, 4000);
  } catch (e) {
    setDeploy('✗ Chyba: ' + e.message, 'error');
  }
}

// ── Deploy bar ────────────────────────────────────
function setDeploy(msg, state) {
  deployBar.hidden = false;
  deployMsg.textContent = msg;
  deployBar.className = 'deploy-bar deploy-bar--' + state;
}

// ── Render ───────────────────────────────────────
function renderStation(sluzba) {
  var isOpen    = (currentStatus[sluzba] || 'volny') === 'volny';
  var station   = document.getElementById('station-' + sluzba);
  var statusTxt = document.getElementById('statusText-' + sluzba);
  var btnLabel  = document.getElementById('btnLabel-' + sluzba);
  if (!station) return;
  station.classList.toggle('volny',    isOpen);
  station.classList.toggle('uzavreny', !isOpen);
  if (statusTxt) statusTxt.textContent = isOpen ? 'VOLNÝ' : 'UZAVŘENÝ';
  if (btnLabel)  btnLabel.textContent  = isOpen ? 'UZAVŘÍT' : 'OTEVŘÍT';
}

function renderAll() {
  SERVICES.forEach(renderStation);
  renderEvent();
}

function renderEvent() {
  var ev      = currentStatus.event || {};
  var isActive = ev.active === true;
  var led     = document.getElementById('led-event');
  var txt     = document.getElementById('statusText-event');
  var lbl     = document.getElementById('btnLabel-event');
  var panel   = document.getElementById('eventPanel');
  if (led)   led.className   = 'status-led ' + (isActive ? 'volny' : '');
  if (txt)   txt.textContent = isActive ? 'AKTIVNÍ' : 'NEAKTIVNÍ';
  if (lbl)   lbl.textContent = isActive ? 'DEAKTIVOVAT' : 'AKTIVOVAT';
  if (panel) panel.classList.toggle('event-panel--active', isActive);
  var nameEl  = document.getElementById('eventName');
  var opisEl  = document.getElementById('eventPopis');
  var odkazEl = document.getElementById('eventOdkaz');
  if (nameEl)  nameEl.value  = ev.name  || '';
  if (opisEl)  opisEl.value  = ev.popis || '';
  if (odkazEl) odkazEl.value = ev.odkaz || '';
}

// ── Toggle ───────────────────────────────────────
async function toggle(sluzba) {
  var prev   = currentStatus[sluzba] || 'volny';
  var next   = prev === 'volny' ? 'uzavreny' : 'volny';
  var action = next === 'uzavreny' ? 'UZAVŘÍT' : 'OTEVŘÍT';
  if (!confirm(action + ' službu ' + sluzba.toUpperCase() + '?')) return;
  currentStatus[sluzba] = next;
  renderStation(sluzba);
  await saveStatus();
}

SERVICES.forEach(function (sluzba) {
  var btn = document.getElementById('btn-' + sluzba);
  if (btn) btn.addEventListener('click', function () { toggle(sluzba); });
});

// ── Master controls ──────────────────────────────
async function setAll(val) {
  var action = val === 'uzavreny' ? 'Uzavřít VŠECHNY?' : 'Otevřít VŠECHNY?';
  if (!confirm(action)) return;
  SERVICES.forEach(function (s) { currentStatus[s] = val; });
  renderAll();
  await saveStatus();
}

document.getElementById('masterClose').addEventListener('click', function () { setAll('uzavreny'); });
document.getElementById('masterOpen').addEventListener('click',  function () { setAll('volny'); });

// ── Event toggle ─────────────────────────────────
document.getElementById('btn-event').addEventListener('click', async function () {
  var ev = currentStatus.event || {};
  currentStatus.event = Object.assign({}, ev, { active: !ev.active });
  renderEvent();
  await saveStatus();
});

// ── Analytics ────────────────────────────────────
function gel(id) { return document.getElementById(id); }

function analyticsErr(msg) {
  var e = gel('analyticsErr');     if (e) { e.textContent = msg; e.hidden = false; }
  var l = gel('analyticsLoading'); if (l) l.hidden = true;
}

function makeBars(data, keyFn, lblFn) {
  var max = Math.max.apply(null, data.map(function(d){ return d.count; })) || 1;
  return data.map(function(d) {
    var ht = Math.max(2, Math.round((d.count / max) * 100));
    return '<div class="analytics-bar">'
      + '<div class="analytics-bar__fill" style="height:' + ht + '%"></div>'
      + '<span class="analytics-bar__lbl">' + lblFn(d) + '</span>'
      + '</div>';
  }).join('');
}

function analyticsLog(msg) {
  var l = gel('analyticsLoading');
  if (l) l.textContent = msg;
}

function loadAnalytics() {
  var l = gel('analyticsLoading'); if (l) { l.hidden = false; l.textContent = 'Načítám...'; }
  var d = gel('analyticsData');    if (d) d.hidden = true;
  var e = gel('analyticsErr');     if (e) e.hidden = true;

  analyticsLog('Krok 1: spouštím fetch...');
  fetch('/api/analytics')
    .then(function(r) { analyticsLog('Krok 2: status ' + r.status + ', parsuju JSON...'); return r.json(); })
    .then(function(json) {
      analyticsLog('Krok 3: JSON ok, pv=' + json.pageviews + ', err=' + json.error);
      var l2 = gel('analyticsLoading'); if (l2) l2.hidden = true;
      if (json.error) { analyticsErr(json.error); return; }

      var pv = gel('analyticsPageviews');
      if (pv) pv.textContent = (json.pageviews || 0).toLocaleString('cs-CZ');

      var td = gel('analyticsToday');
      if (td) td.textContent = (json.todayPv || 0).toLocaleString('cs-CZ');

      var bToday = gel('analyticsBarsToday');
      if (bToday && json.hours) bToday.innerHTML = makeBars(json.hours, function(h){ return h.hour; }, function(h){ return h.hour % 6 === 0 ? h.hour + 'h' : ''; });

      var b7 = gel('analyticsBars7d');
      if (b7 && json.days) b7.innerHTML = makeBars(json.days, function(d){ return d.date; }, function(d){ return d.date.slice(5).replace('-','/'); });

      var pg = gel('analyticsPages');
      if (pg) {
        var pageLabels = {'/':'Úvod','/sluzby.html':'Služby','/omne.html':'O mně',
          '/jakpracuji.html':'Jak pracuji','/faq.html':'FAQ','/kontakt.html':'Kontakt',
          '/objednavka.html':'Objednávka','/dekujeme.html':'Děkujeme'};
        pg.innerHTML = (json.topPages||[]).map(function(p){
          return '<li class="analytics-page-row"><span class="analytics-page-name">'+(pageLabels[p.path]||p.path)+'</span><span class="analytics-page-count">'+p.count+'</span></li>';
        }).join('') || '<li class="analytics-page-row"><span class="analytics-page-name" style="color:var(--sub)">žádná data</span></li>';
      }

      var dv = gel('analyticsDevices');
      if (dv) {
        var dlbl = {'Desktop':'Desktop','Mobile':'Mobil','Tablet':'Tablet','Bot':'Bot'};
        dv.innerHTML = (json.devices||[]).map(function(d){
          return '<li class="analytics-device-row"><span class="analytics-device-name">'+(dlbl[d.type]||d.type)+'</span><span class="analytics-device-bar"><span class="analytics-device-fill" style="width:'+d.pct+'%"></span></span><span class="analytics-device-pct">'+d.pct+'%</span></li>';
        }).join('') || '<li class="analytics-device-row"><span class="analytics-device-name" style="color:var(--sub)">žádná data</span></li>';
      }

      var da = gel('analyticsData'); if (da) da.hidden = false;
    })
    .catch(function(e) { analyticsErr('Chyba: ' + e.message); });
}

// ── Event save ───────────────────────────────────
document.getElementById('eventSave').addEventListener('click', async function () {
  currentStatus.event = {
    active: (currentStatus.event || {}).active === true,
    name:   document.getElementById('eventName').value.trim(),
    popis:  document.getElementById('eventPopis').value.trim(),
    odkaz:  document.getElementById('eventOdkaz').value.trim()
  };
  await saveStatus();
});
