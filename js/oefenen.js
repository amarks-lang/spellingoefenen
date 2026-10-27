// Leerlingscherm: woord flitsen, typen, goed/fout, blokken van 30, medailles.
import {
  auth, db, configOk, signInAnonymously, ref, get, set, push, onValue, serverTimestamp
} from './firebase.js';
import { NIVEAUS } from './woorden.js';
import { BLOK_GROOTTE, STANDAARD_FLITSTIJD, normaliseer, schud } from './gedeeld.js';

window.__spellingGestart = true;
const $ = sel => document.querySelector(sel);

const st = {
  code: null,          // klascode
  klasId: null,
  llnId: null,
  leerling: null,      // { naam, niveau, flitsTijd } — volgt live wat de leerkracht instelt
  voortgang: null,     // { blok, woordInBlok, medailles, niveau, blokWoorden[], blokUitslag[] }
  huidig: null,        // { woord, poging, beurt }
  invoerOpen: false,
  timer: null,
  stopLuisteren: null
};

// ---------- schermen ----------

function toon(naam) {
  for (const el of document.querySelectorAll('[data-scherm]')) el.hidden = el.dataset.scherm !== naam;
  document.body.dataset.fase = naam;
  const metBalk = ['start', 'kijk', 'typ', 'goed', 'fout', 'juist', 'medaille'].includes(naam);
  $('.balk').hidden = !metBalk;
}

function wacht(ms) {
  return new Promise(klaar => { st.timer = setTimeout(klaar, ms); });
}

function melding(tekst) {
  $('#melding-tekst').textContent = tekst;
  toon('melding');
}

function flitsTijd() {
  const s = Number(st.leerling && st.leerling.flitsTijd);
  return s >= 1 && s <= 10 ? s : STANDAARD_FLITSTIJD;
}

// ---------- schrijflijnen op de echte lettermaten zetten ----------

const meetDoek = document.createElement('canvas').getContext('2d');

function plaatsLijnen(el) {
  const cs = getComputedStyle(el);
  const grootte = parseFloat(cs.fontSize);
  const regel = parseFloat(cs.lineHeight);
  meetDoek.font = `${cs.fontWeight} ${grootte}px ${cs.fontFamily}`;
  const x = meetDoek.measureText('x');
  const k = meetDoek.measureText('k');
  const p = meetDoek.measureText('p');
  if (!x.fontBoundingBoxAscent || !regel) return;
  const basis = (regel - (x.fontBoundingBoxAscent + x.fontBoundingBoxDescent)) / 2 + x.fontBoundingBoxAscent;
  const yX = basis - x.actualBoundingBoxAscent;
  el.style.setProperty('--y-basis', `${basis - 1}px`);
  el.style.setProperty('--y-x', `${yX}px`);
  el.style.setProperty('--y-stok', `${basis - k.actualBoundingBoxAscent}px`);
  el.style.setProperty('--y-staart', `${basis + p.actualBoundingBoxDescent}px`);
  el.style.setProperty('--band-h', `${basis - yX}px`);
}

function plaatsAlleLijnen() {
  document.querySelectorAll('.schrift').forEach(el => {
    if (el.offsetParent !== null) plaatsLijnen(el);
  });
}
window.addEventListener('resize', plaatsAlleLijnen);

// ---------- opstarten ----------

async function begin() {
  if (!configOk) return melding('Deze site is nog niet gekoppeld aan Firebase. Vul js/config.js in.');
  toon('laden');
  try {
    await signInAnonymously(auth);
  } catch (e) {
    console.error(e);
    return melding('Inloggen lukt niet. Zet in Firebase bij Authentication de aanmeldmethode Anoniem aan.');
  }
  await document.fonts.ready;
  route();
}

window.addEventListener('hashchange', () => {
  clearTimeout(st.timer);
  st.invoerOpen = false;
  route();
});

function route() {
  let hash = location.hash.slice(1);
  try { hash = decodeURIComponent(hash); } catch (e) { /* laat zoals het is */ }
  const [code = '', lln = ''] = hash.split('/');
  const c = code.trim().toUpperCase();
  if (c && lln) return openLeerling(c, lln.trim());
  if (c) return toonNamen(c);
  toonCode();
}

async function zoekKlas(code) {
  if (!/^[A-Z0-9]{6}$/.test(code)) return null;
  try {
    const s = await get(ref(db, `klascodes/${code}`));
    return s.exists() ? s.val() : null;
  } catch (e) {
    console.error(e);
    return null;
  }
}

// ---------- klascode en naam kiezen (reserve als er geen oefenlink is) ----------

function toonCode(foutTekst = '') {
  toon('code');
  $('#code-melding').textContent = foutTekst;
  const inp = $('#code-invoer');
  inp.focus();
}

$('#code-form').addEventListener('submit', e => {
  e.preventDefault();
  const c = $('#code-invoer').value.replace(/\s/g, '').toUpperCase();
  if (c.length !== 6) return toonCode('Een klascode heeft 6 tekens.');
  if (location.hash.slice(1) === c) route();
  else location.hash = c;
});

async function toonNamen(code) {
  toon('laden');
  const klasId = await zoekKlas(code);
  if (!klasId) {
    $('#code-invoer').value = code;
    return toonCode('Deze klascode bestaat niet. Kijk nog eens goed.');
  }
  let leerlingen = {};
  try {
    leerlingen = (await get(ref(db, `klassen/${klasId}/leerlingen`))).val() || {};
  } catch (e) {
    console.error(e);
  }
  const vak = $('#namen');
  vak.replaceChildren();
  const lijst = Object.entries(leerlingen).sort((a, b) => a[1].naam.localeCompare(b[1].naam, 'nl'));
  if (!lijst.length) {
    const p = document.createElement('p');
    p.className = 'leeg';
    p.textContent = 'Er staan nog geen leerlingen in deze klas.';
    vak.append(p);
  }
  for (const [id, lln] of lijst) {
    const knop = document.createElement('button');
    knop.className = 'naamknop';
    knop.textContent = lln.naam;
    knop.addEventListener('click', () => { location.hash = `${code}/${id}`; });
    vak.append(knop);
  }
  toon('namen');
}

// ---------- leerling openen ----------

function alsLijst(x) {
  if (Array.isArray(x)) return x.filter(v => v != null);
  if (x && typeof x === 'object') return Object.keys(x).sort((a, b) => a - b).map(k => x[k]);
  return [];
}

function leesVoortgang(v) {
  return {
    blok: Number(v && v.blok) || 1,
    woordInBlok: Number(v && v.woordInBlok) || 0,
    medailles: Number(v && v.medailles) || 0,
    niveau: (v && v.niveau) || null,
    blokWoorden: alsLijst(v && v.blokWoorden),
    blokUitslag: alsLijst(v && v.blokUitslag)
  };
}

async function openLeerling(code, llnId) {
  toon('laden');
  const kapot = 'Deze oefenlink werkt niet (meer). Vraag de leerkracht om een nieuwe link.';
  try {
    const klasId = await zoekKlas(code);
    if (!klasId) return melding(kapot);
    const ls = await get(ref(db, `klassen/${klasId}/leerlingen/${llnId}`));
    if (!ls.exists()) return melding(kapot);
    Object.assign(st, { code, klasId, llnId, leerling: ls.val() });
    const vs = await get(ref(db, `voortgang/${klasId}/${llnId}`));
    st.voortgang = leesVoortgang(vs.val());

    // Niveau en flitstijd volgen live wat de leerkracht instelt.
    if (st.stopLuisteren) st.stopLuisteren();
    st.stopLuisteren = onValue(ref(db, `klassen/${klasId}/leerlingen/${llnId}`), s => {
      if (s.exists()) st.leerling = s.val();
    });
    toonStart();
  } catch (e) {
    console.error(e);
    melding('Er ging iets mis bij het laden. Laad de pagina opnieuw.');
  }
}

function toonStart() {
  $('#groet').textContent = `Hoi ${st.leerling.naam}!`;
  zorgVoorBlok();
  tekenBalk();
  toon('start');
  $('#start-knop').focus();
}

$('#start-knop').addEventListener('click', volgendWoord);
$('#verder-knop').addEventListener('click', volgendWoord);

// ---------- blokken en woorden ----------

function kiesWoorden(niveau, vorige = []) {
  const alle = NIVEAUS[niveau].woorden;
  let pool = alle.filter(w => !vorige.includes(w));
  if (pool.length < BLOK_GROOTTE) pool = alle;
  let gekozen = schud(pool).slice(0, BLOK_GROOTTE);
  while (gekozen.length < BLOK_GROOTTE) gekozen = gekozen.concat(schud(alle)).slice(0, BLOK_GROOTTE);
  return gekozen;
}

// Zorgt dat er woorden klaarliggen voor het huidige blok, op het niveau dat de leerkracht koos.
function zorgVoorBlok() {
  const v = st.voortgang;
  const niveau = NIVEAUS[st.leerling.niveau] ? st.leerling.niveau : 'mkm';
  if (v.niveau !== niveau || v.blokWoorden.length !== BLOK_GROOTTE) {
    v.blokWoorden = kiesWoorden(niveau, v.blokWoorden);
    v.niveau = niveau;
  }
  if (v.woordInBlok >= BLOK_GROOTTE) v.woordInBlok = 0;
  v.blokUitslag = v.blokUitslag.slice(0, v.woordInBlok);
}

// Kralensnoer tekenen. Bij de medaille geven we het volle snoer van het afgeronde blok mee.
function tekenBalk(afgerond = null) {
  const v = st.voortgang;
  const uitslag = afgerond || v.blokUitslag;
  const kralen = [];
  for (let i = 0; i < BLOK_GROOTTE; i++) {
    const k = document.createElement('span');
    k.className = 'kraal';
    const u = uitslag[i];
    if (u) k.classList.add(`k-${u}`);
    else if (!afgerond && i === v.woordInBlok) k.classList.add('k-nu');
    kralen.push(k);
  }
  $('#kralen').replaceChildren(...kralen);
  $('#kralen').setAttribute('aria-label', `Woord ${Math.min(v.woordInBlok + 1, BLOK_GROOTTE)} van ${BLOK_GROOTTE}`);
  $('#aantal-medailles').textContent = v.medailles;
}

function volgendWoord() {
  zorgVoorBlok();
  const v = st.voortgang;
  st.huidig = {
    woord: v.blokWoorden[v.woordInBlok],
    poging: 1,
    beurt: `${v.blok}-${v.woordInBlok + 1}`
  };
  tekenBalk();
  kijk();
}

// 1. woord laten zien
async function kijk() {
  const sec = flitsTijd();
  $('#woord-kijk').textContent = st.huidig.woord;
  toon('kijk');
  plaatsLijnen($('#schrift-kijk'));

  const lont = $('#lont');
  lont.style.transition = 'none';
  lont.style.transform = 'scaleX(1)';
  void lont.offsetWidth;
  lont.style.transition = `transform ${sec}s linear`;
  lont.style.transform = 'scaleX(0)';

  await wacht(sec * 1000);
  typ();
}

// 2. woord weg, kind typt
function typ() {
  $('#woord-kijk').textContent = '';
  const inp = $('#typ-invoer');
  inp.value = '';
  toon('typ');
  plaatsLijnen(inp);
  st.invoerOpen = true;
  inp.focus();
}

$('#typ-form').addEventListener('submit', e => {
  e.preventDefault();
  if (!st.invoerOpen) return;
  const inp = $('#typ-invoer');
  if (!normaliseer(inp.value)) return inp.focus();
  st.invoerOpen = false;
  inp.blur();
  beoordeel(inp.value);
});

// Klikken naast het invoerveld mag de focus niet wegnemen.
document.addEventListener('pointerup', () => {
  if (st.invoerOpen) $('#typ-invoer').focus();
});

// 3. goed of fout
async function beoordeel(getypt) {
  const h = st.huidig;
  const goed = normaliseer(getypt) === h.woord;
  bewaarPoging(getypt, goed);

  if (goed) {
    $('#woord-goed').textContent = h.woord;
    toon('goed');
    plaatsLijnen($('#schrift-goed'));
    await wacht(1400);
    return klaarMetWoord(h.poging === 1 ? 'g' : 'h');
  }

  toon('fout');
  await wacht(1300);
  if (h.poging === 1) {
    h.poging = 2;               // herkansing: zelfde woord nog een keer
    return kijk();
  }
  // tweede keer fout: goede woord laten zien en door
  $('#woord-juist').textContent = h.woord;
  toon('juist');
  plaatsLijnen($('#schrift-juist'));
  await wacht(Math.max(3, flitsTijd()) * 1000);
  klaarMetWoord('f');
}

function klaarMetWoord(uitslag) {
  const v = st.voortgang;
  v.blokUitslag[v.woordInBlok] = uitslag;
  v.woordInBlok += 1;
  if (v.woordInBlok >= BLOK_GROOTTE) {
    const afgerond = v.blokUitslag.slice();
    v.medailles += 1;
    v.blok += 1;
    v.woordInBlok = 0;
    v.blokUitslag = [];
    v.blokWoorden = kiesWoorden(v.niveau, v.blokWoorden);
    bewaarVoortgang();
    return toonMedaille(afgerond);
  }
  bewaarVoortgang();
  volgendWoord();
}

async function toonMedaille(afgerond) {
  $('#medaille-getal').textContent = st.voortgang.medailles;
  tekenBalk(afgerond);
  // animatie opnieuw starten
  const m = $('.medaille');
  m.style.animation = 'none';
  void m.getBoundingClientRect();
  m.style.animation = '';
  toon('medaille');
  await wacht(1100);
  $('#verder-knop').focus();
}

// ---------- opslaan ----------

function opslagFout(e) {
  console.error(e);
  $('#opslagfout').hidden = false;
}

function bewaarPoging(getypt, goed) {
  const h = st.huidig;
  push(ref(db, `pogingen/${st.klasId}/${st.llnId}`), {
    woord: h.woord,
    getypt: String(getypt).trim().slice(0, 40),
    goed,
    poging: h.poging,
    niveau: st.voortgang.niveau,
    blok: st.voortgang.blok,
    beurt: h.beurt,
    tijd: serverTimestamp()
  }).catch(opslagFout);
}

function bewaarVoortgang() {
  const v = st.voortgang;
  set(ref(db, `voortgang/${st.klasId}/${st.llnId}`), {
    blok: v.blok,
    woordInBlok: v.woordInBlok,
    medailles: v.medailles,
    niveau: v.niveau,
    blokWoorden: v.blokWoorden,
    blokUitslag: v.blokUitslag,
    laatst: serverTimestamp()
  }).then(() => { $('#opslagfout').hidden = true; }).catch(opslagFout);
}

begin();
