/**
 * Změn heslo níže na vlastní:
 */
var ADMIN_PASS   = 'koblas123';
var SESSION_KEY  = 'kkoblas_admin_session';

var SERVICES = ['startup', 'mentoring', 'ultimate'];
var STATUS_KEY = function (s) { return 'kkoblas_status_' + s; };

// ── Auth ────────────────────────────────────────
var lockScreen = document.getElementById('lockScreen');
var consolEl   = document.getElementById('console');
var lockForm   = document.getElementById('lockForm');
var lockInput  = document.getElementById('lockInput');
var lockError  = document.getElementById('lockError');

function unlock() {
  lockScreen.style.display = 'none';
  consolEl.hidden = false;
  sessionStorage.setItem(SESSION_KEY, '1');
  renderAll();
}

if (sessionStorage.getItem(SESSION_KEY) === '1') {
  unlock();
}

lockForm.addEventListener('submit', function (e) {
  e.preventDefault();
  if (lockInput.value === ADMIN_PASS) {
    unlock();
  } else {
    lockInput.value = '';
    lockError.hidden = false;
    lockError.style.animation = 'none';
    void lockError.offsetWidth;
    lockError.style.animation = 'shake .3s ease';
  }
});

// ── State helpers ────────────────────────────────
function getStatus(sluzba) {
  return localStorage.getItem(STATUS_KEY(sluzba)) || 'volny';
}

function setStatus(sluzba, val) {
  localStorage.setItem(STATUS_KEY(sluzba), val);
}

// ── Render ───────────────────────────────────────
function renderStation(sluzba) {
  var status    = getStatus(sluzba);
  var station   = document.getElementById('station-' + sluzba);
  var led       = document.getElementById('led-' + sluzba);
  var statusTxt = document.getElementById('statusText-' + sluzba);
  var btnLabel  = document.getElementById('btnLabel-' + sluzba);

  if (!station) return;

  var isOpen = status === 'volny';
  station.classList.toggle('volny',     isOpen);
  station.classList.toggle('uzavreny', !isOpen);

  if (statusTxt) statusTxt.textContent = isOpen ? 'VOLNÝ' : 'UZAVŘENÝ';
  if (btnLabel)  btnLabel.textContent  = isOpen ? 'UZAVŘÍT' : 'OTEVŘÍT';
}

function renderAll() {
  SERVICES.forEach(renderStation);
}

// ── Toggle ───────────────────────────────────────
function toggle(sluzba) {
  var current = getStatus(sluzba);
  var next    = current === 'volny' ? 'uzavreny' : 'volny';
  var label   = sluzba.toUpperCase();
  var action  = next === 'uzavreny' ? 'UZAVŘÍT' : 'OTEVŘÍT';

  if (!confirm(action + ' službu ' + label + '?')) return;

  setStatus(sluzba, next);
  renderStation(sluzba);
}

SERVICES.forEach(function (sluzba) {
  var btn = document.getElementById('btn-' + sluzba);
  if (btn) btn.addEventListener('click', function () { toggle(sluzba); });
});

// ── Master controls ──────────────────────────────
document.getElementById('masterClose').addEventListener('click', function () {
  if (!confirm('Uzavřít VŠECHNY služby?')) return;
  SERVICES.forEach(function (s) { setStatus(s, 'uzavreny'); });
  renderAll();
});

document.getElementById('masterOpen').addEventListener('click', function () {
  if (!confirm('Otevřít VŠECHNY služby?')) return;
  SERVICES.forEach(function (s) { setStatus(s, 'volny'); });
  renderAll();
});

// Synchronizace mezi záložkami (pokud má admin otevřené obě stránky)
window.addEventListener('storage', function (e) {
  if (e.key && e.key.startsWith('kkoblas_status_')) {
    var sluzba = e.key.replace('kkoblas_status_', '');
    renderStation(sluzba);
  }
});
