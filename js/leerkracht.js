// Leerkrachtpagina: klassen, leerlingen, niveau en flitstijd, oefenlinks en fouten.
import {
  auth, db, configOk, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut,
  ref, get, set, update, push, remove, onValue, query, orderByChild, equalTo, serverTimestamp
} from './firebase.js';
import { LEERKRACHT_DOMEIN } from './config.js';
import { NIVEAUS, NIVEAU_VOLGORDE } from './woorden.js';
import { FLITSTIJDEN, STANDAARD_FLITSTIJD, maakCode, esc, beurtenUit } from './gedeeld.js';

window.__spellingGestart = true;
const $ = sel => document.querySelector(sel);

const st = {
  user: null,
  eigen: {},            // klassen waarvan ik eigenaar ben
  gedeeldeKlassen: {},  // klassen die een collega met mij deelt
  gedeeldStops: new Map(),
  klassen: {},          // eigen + gedeeld samen
  klasId: null,
  leerlingen: {},
  voortgang: {},
  pogingen: {},
  foutenVan: null,
  stopKlassen: [],
  stopKlas: []
};

// E-mailadres als sleutel in de database: punten mogen niet, dus worden het komma's.
// Moet precies overeenkomen met auth.token.email.toLowerCase().replace('.', ',') in de rules.
function mailSleutel(mail) {
  return String(mail || '').trim().toLowerCase().replace(/\./g, ',');
}
function mailUitSleutel(sleutel) {
  return String(sleutel).replace(/,/g, '.');
}
function benEigenaar(id = st.klasId) {
  const k = st.klassen[id];
  return !!(k && st.user && k.eigenaar === st.user.uid);
}

const SECTIES = ['#s-melding', '#s-laden', '#s-login', '#s-app'];
function toonSectie(id) {
  for (const s of SECTIES) $(s).hidden = s !== id;
}
function toonMelding(tekst) {
  $('#melding-tekst').textContent = tekst;
  toonSectie('#s-melding');
}

function datumTijd(t) {
  if (!t) return '–';
  return new Date(t).toLocaleString('nl-NL', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  });
}

function oefenlink(llnId) {
  const basis = new URL('./', location.href).href;
  return `${basis}#${st.klassen[st.klasId].code}/${llnId}`;
}

// Knop die eerst om bevestiging vraagt: tweede klik binnen 4 seconden voert uit.
function bevestigKnop(knop, tekstVraag, actie) {
  if (knop.dataset.vraagt) {
    clearTimeout(Number(knop.dataset.vraagt));
    delete knop.dataset.vraagt;
    return actie();
  }
  const oud = knop.textContent;
  knop.textContent = tekstVraag;
  knop.classList.add('gevaar');
  const t = setTimeout(() => {
    knop.textContent = oud;
    knop.classList.remove('gevaar');
    delete knop.dataset.vraagt;
  }, 4000);
  knop.dataset.vraagt = String(t);
}

function foutBericht(e, wat) {
  console.error(e);
  const code = (e && e.code) || '';
  if (/permission/i.test(code) || /permission/i.test(e && e.message)) {
    return `${wat} lukt niet: geen toestemming. Staan de database rules goed in Firebase?`;
  }
  return `${wat} lukt niet. Is er internet? (${(e && e.message) || e})`;
}

// ---------- inloggen ----------

if (!configOk) {
  toonMelding('Deze site is nog niet gekoppeld aan Firebase. Vul js/config.js in.');
} else {
  onAuthStateChanged(auth, user => {
    stopAlles();
    st.user = null;
    if (!user || user.isAnonymous) {
      $('#gebruiker').hidden = true;
      return toonSectie('#s-login');
    }
    $('#gebruiker').hidden = false;
    $('#gebruiker-mail').textContent = user.email || '';
    const domeinOk = (user.email || '').toLowerCase().endsWith(`@${LEERKRACHT_DOMEIN}`);
    if (!domeinOk) {
      $('#login-fout').textContent = `Log in met een @${LEERKRACHT_DOMEIN}-account. Je bent nu ingelogd als ${user.email}.`;
      return toonSectie('#s-login');
    }
    $('#login-fout').textContent = '';
    st.user = user;
    toonSectie('#s-app');
    luisterNaarKlassen();
  });
}

$('#login').addEventListener('click', async () => {
  $('#login-fout').textContent = '';
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ hd: LEERKRACHT_DOMEIN, prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e && e.code) || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
    let tekst = `Inloggen lukt niet (${code || e.message}).`;
    if (code === 'auth/operation-not-allowed') tekst = 'Inloggen met Google staat nog uit. Zet het aan in Firebase bij Authentication.';
    if (code === 'auth/unauthorized-domain') tekst = `Voeg ${location.hostname} toe in Firebase bij Authentication > Settings > Authorized domains.`;
    if (code === 'auth/popup-blocked') tekst = 'De browser blokkeerde het inlogvenster. Sta pop-ups toe voor deze site en probeer opnieuw.';
    $('#login-fout').textContent = tekst;
  }
});

$('#uitloggen').addEventListener('click', () => signOut(auth));

function stopAlles() {
  st.stopKlassen.forEach(stop => stop());
  st.stopKlassen = [];
  st.gedeeldStops.forEach(stop => stop());
  st.gedeeldStops.clear();
  st.eigen = {};
  st.gedeeldeKlassen = {};
  st.klassen = {};
  st.klasId = null;
  stopKlas();
  wisAlert();
}
function stopKlas() {
  st.stopKlas.forEach(stop => stop());
  st.stopKlas = [];
}

// ---------- klassen ----------

function luisterNaarKlassen() {
  // 1. klassen waarvan ik eigenaar ben
  const q = query(ref(db, 'klassen'), orderByChild('eigenaar'), equalTo(st.user.uid));
  st.stopKlassen.push(onValue(q, snap => {
    st.eigen = snap.val() || {};
    klassenBijgewerkt();
  }, e => toonMelding(foutBericht(e, 'Klassen laden'))));

  // 2. klassen die een duo-collega met mij deelt
  st.stopKlassen.push(onValue(ref(db, `gedeeld/${mailSleutel(st.user.email)}`), snap => {
    const ids = Object.keys(snap.val() || {});
    for (const [id, stop] of st.gedeeldStops) {
      if (!ids.includes(id)) {
        stop();
        st.gedeeldStops.delete(id);
        delete st.gedeeldeKlassen[id];
      }
    }
    for (const id of ids) {
      if (st.gedeeldStops.has(id)) continue;
      st.gedeeldStops.set(id, onValue(ref(db, `klassen/${id}`), s => {
        if (s.exists()) st.gedeeldeKlassen[id] = s.val();
        else delete st.gedeeldeKlassen[id];
        klassenBijgewerkt();
      }, () => {
        // geen toegang meer (collega weggehaald of klas gewist)
        delete st.gedeeldeKlassen[id];
        klassenBijgewerkt();
      }));
    }
    klassenBijgewerkt();
  }, e => console.error(e)));
}

function klassenBijgewerkt() {
  st.klassen = { ...st.gedeeldeKlassen, ...st.eigen };
  const ids = Object.keys(st.klassen);
  if (!st.klasId || !st.klassen[st.klasId]) {
    let bewaard = null;
    try { bewaard = localStorage.getItem('spellingoefenen.klas'); } catch (e) { /* geen opslag */ }
    const opNaam = ids.sort((a, b) => st.klassen[a].naam.localeCompare(st.klassen[b].naam, 'nl'));
    const keuze = ids.includes(bewaard) ? bewaard : (opNaam[0] || null);
    if (keuze !== st.klasId) kiesKlas(keuze);
    else { $('#geen-klas').hidden = !!keuze; $('#klas').hidden = !keuze; }
  } else {
    tekenKlasKop();
  }
  tekenKlaslijst();
}

function tekenKlaslijst() {
  const items = Object.entries(st.klassen)
    .sort((a, b) => a[1].naam.localeCompare(b[1].naam, 'nl'))
    .map(([id, k]) => {
      const gedeeld = k.eigenaar !== st.user.uid ? ' <span class="label-gedeeld">gedeeld</span>' : '';
      return `<li><button class="klasknop${id === st.klasId ? ' actief' : ''}" data-id="${esc(id)}">${esc(k.naam)}${gedeeld}</button></li>`;
    });
  $('#klaslijst').innerHTML = items.join('');
}

$('#klaslijst').addEventListener('click', e => {
  const knop = e.target.closest('.klasknop');
  if (knop) kiesKlas(knop.dataset.id);
});

async function vrijeCode() {
  for (let i = 0; i < 12; i++) {
    const code = maakCode();
    const s = await get(ref(db, `klascodes/${code}`));
    if (!s.exists()) return code;
  }
  throw new Error('Geen vrije klascode gevonden');
}

$('#nieuwe-klas').addEventListener('submit', async e => {
  e.preventDefault();
  const naam = $('#klasnaam').value.trim();
  if (!naam) return;
  const knop = e.submitter || $('#nieuwe-klas button');
  knop.disabled = true;
  try {
    const code = await vrijeCode();
    const klasRef = push(ref(db, 'klassen'));
    await set(klasRef, {
      naam, eigenaar: st.user.uid, eigenaarMail: st.user.email || '', code, aangemaakt: serverTimestamp()
    });
    await set(ref(db, `klascodes/${code}`), klasRef.key);
    $('#klasnaam').value = '';
    kiesKlas(klasRef.key);
  } catch (err) {
    alertInline(foutBericht(err, 'Klas aanmaken'));
  } finally {
    knop.disabled = false;
  }
});

function alertInline(tekst) {
  let p = $('#app-fout');
  if (!p) {
    p = document.createElement('p');
    p.id = 'app-fout';
    p.className = 'foutmelding';
    p.setAttribute('role', 'alert');
    $('.klasvak').prepend(p);
  }
  p.textContent = tekst;
  clearTimeout(alertInline.t);
  alertInline.t = setTimeout(() => p.remove(), 8000);
}

function wisAlert() {
  clearTimeout(alertInline.t);
  const p = $('#app-fout');
  if (p) p.remove();
}

function kiesKlas(id) {
  stopKlas();
  st.klasId = id;
  st.leerlingen = {};
  st.voortgang = {};
  st.pogingen = {};
  st.foutenVan = null;
  try { if (id) localStorage.setItem('spellingoefenen.klas', id); } catch (e) { /* geen opslag */ }
  tekenKlaslijst();
  $('#geen-klas').hidden = !!id;
  $('#klas').hidden = !id;
  if (!id) return;
  tekenKlasKop();
  tekenLeerlingen();
  tekenFouten();
  const fout = e => alertInline(foutBericht(e, 'Gegevens laden'));
  st.stopKlas.push(
    onValue(ref(db, `klassen/${id}/leerlingen`), s => { st.leerlingen = s.val() || {}; tekenLeerlingen(); tekenFouten(); }, fout),
    onValue(ref(db, `voortgang/${id}`), s => { st.voortgang = s.val() || {}; tekenLeerlingen(); }, fout),
    onValue(ref(db, `pogingen/${id}`), s => { st.pogingen = s.val() || {}; tekenLeerlingen(); tekenFouten(); }, fout)
  );
}

function tekenKlasKop() {
  const k = st.klassen[st.klasId];
  if (!k) return;
  const eigenaar = benEigenaar();
  $('#klas-naam').textContent = k.naam;
  $('#klas-code').textContent = k.code;
  $('#klas-verwijderen').hidden = !eigenaar;
  $('#delen').hidden = !eigenaar;
  $('#gedeeld-door').hidden = eigenaar;
  if (!eigenaar) {
    $('#gedeeld-door').textContent = k.eigenaarMail
      ? `Gedeeld door ${k.eigenaarMail}. Jullie zien dezelfde leerlingen en resultaten.`
      : 'Gedeeld door je duo-collega. Jullie zien dezelfde leerlingen en resultaten.';
    return;
  }
  // Oudere klassen hebben nog geen eigenaarMail; die vullen we aan zodat collega's zien van wie de klas is.
  if (!k.eigenaarMail && st.user.email) {
    update(ref(db, `klassen/${st.klasId}`), { eigenaarMail: st.user.email }).catch(e => console.error(e));
  }
  const collegas = Object.keys(k.collegas || {}).map(mailUitSleutel).sort();
  $('#collega-lijst').innerHTML = collegas.length
    ? collegas.map(m => `<li class="collega"><span>${esc(m)}</span><button class="weghalen" data-mail="${esc(m)}" aria-label="${esc(m)} weghalen">×</button></li>`).join('')
    : '<li class="zacht">Nog met niemand gedeeld.</li>';
}

// ---------- klas delen met een duo-collega ----------

$('#nieuwe-collega').addEventListener('submit', async e => {
  e.preventDefault();
  const invoer = $('#collega-mail');
  const mail = invoer.value.trim().toLowerCase();
  const id = st.klasId;
  if (!id || !benEigenaar(id)) return;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return alertInline('Vul een geldig e-mailadres in.');
  if (!mail.endsWith(`@${LEERKRACHT_DOMEIN}`)) return alertInline(`Je collega kan alleen inloggen met een @${LEERKRACHT_DOMEIN}-account.`);
  if (mail === (st.user.email || '').toLowerCase()) return alertInline('Dat ben je zelf: je ziet deze klas al.');
  const sleutel = mailSleutel(mail);
  try {
    await update(ref(db), {
      [`klassen/${id}/collegas/${sleutel}`]: true,
      [`gedeeld/${sleutel}/${id}`]: true
    });
    invoer.value = '';
    wisAlert();
  } catch (err) {
    alertInline(foutBericht(err, 'Collega toevoegen'));
  }
});

$('#collega-lijst').addEventListener('click', async e => {
  const knop = e.target.closest('.weghalen');
  if (!knop || !benEigenaar()) return;
  const sleutel = mailSleutel(knop.dataset.mail);
  try {
    await update(ref(db), {
      [`klassen/${st.klasId}/collegas/${sleutel}`]: null,
      [`gedeeld/${sleutel}/${st.klasId}`]: null
    });
  } catch (err) {
    alertInline(foutBericht(err, 'Collega weghalen'));
  }
});

$('#klas-verwijderen').addEventListener('click', e => {
  const k = st.klassen[st.klasId];
  if (!k || !benEigenaar()) return;
  bevestigKnop(e.currentTarget, 'Klik nog eens: alles van deze klas wissen', async () => {
    const id = st.klasId;
    try {
      stopKlas();
      const opruimen = {};
      for (const sleutel of Object.keys(k.collegas || {})) opruimen[`gedeeld/${sleutel}/${id}`] = null;
      if (Object.keys(opruimen).length) await update(ref(db), opruimen);
      await remove(ref(db, `klascodes/${k.code}`));
      await remove(ref(db, `pogingen/${id}`));
      await remove(ref(db, `voortgang/${id}`));
      await remove(ref(db, `klassen/${id}`));
      // de klassenlijst kiest daarna vanzelf een andere klas (of toont 'maak een klas aan')
    } catch (err) {
      alertInline(foutBericht(err, 'Klas verwijderen'));
      kiesKlas(id);
    }
  });
});

// ---------- leerlingen ----------

$('#nieuwe-leerling').addEventListener('submit', async e => {
  e.preventDefault();
  const naam = $('#lln-naam').value.trim();
  if (!naam || !st.klasId) return;
  try {
    await push(ref(db, `klassen/${st.klasId}/leerlingen`), {
      naam, niveau: 'mkm', flitsTijd: STANDAARD_FLITSTIJD
    });
    $('#lln-naam').value = '';
    $('#lln-naam').focus();
  } catch (err) {
    alertInline(foutBericht(err, 'Leerling toevoegen'));
  }
});

function niveauOpties(huidig) {
  return NIVEAU_VOLGORDE.map(n =>
    `<option value="${n}"${n === huidig ? ' selected' : ''}>${n} (${NIVEAUS[n].voorbeeld})</option>`
  ).join('');
}

function flitsOpties(huidig) {
  const lijst = FLITSTIJDEN.includes(huidig) ? FLITSTIJDEN : [...FLITSTIJDEN, huidig].sort((a, b) => a - b);
  return lijst.map(s => `<option value="${s}"${s === huidig ? ' selected' : ''}>${s} sec</option>`).join('');
}

function tellingen(llnId) {
  const beurten = beurtenUit(st.pogingen[llnId]);
  const t = { woorden: beurten.length, g: 0, h: 0, f: 0 };
  for (const b of beurten) t[b.uitkomst] += 1;
  return t;
}

function tekenLeerlingen() {
  const lijst = Object.entries(st.leerlingen).sort((a, b) => a[1].naam.localeCompare(b[1].naam, 'nl'));
  $('#geen-leerlingen').hidden = lijst.length > 0;
  $('.tabelvak').hidden = lijst.length === 0;

  // focus bewaren als een keuzelijst net open/gekozen is
  const actief = document.activeElement;
  const focusSleutel = actief && actief.closest && actief.closest('#lln-rijen tr')
    ? [actief.closest('tr').dataset.id, actief.className] : null;

  $('#lln-rijen').innerHTML = lijst.map(([id, l]) => {
    const t = tellingen(id);
    const v = st.voortgang[id] || {};
    const flits = Number(l.flitsTijd) || STANDAARD_FLITSTIJD;
    return `<tr data-id="${esc(id)}"${id === st.foutenVan ? ' class="gekozen"' : ''}>
      <td class="naam">${esc(l.naam)}</td>
      <td><select class="niveau" aria-label="Niveau van ${esc(l.naam)}">${niveauOpties(l.niveau)}</select></td>
      <td><select class="flits" aria-label="Flitstijd van ${esc(l.naam)}">${flitsOpties(flits)}</select></td>
      <td class="getal">${t.woorden}</td>
      <td class="resultaat" aria-label="${t.g} in één keer goed, ${t.h} goed na herkansing, ${t.f} fout">
        <span class="r"><span class="bol g"></span>${t.g}</span><span class="r"><span class="bol h"></span>${t.h}</span><span class="r"><span class="bol f"></span>${t.f}</span>
      </td>
      <td class="getal">${Number(v.medailles) || 0}</td>
      <td>${datumTijd(v.laatst)}</td>
      <td class="acties"><button class="knop stil klein kopieer">Kopieer oefenlink</button><button class="knop stil klein toon-fouten">Fouten</button><button class="knop gevaar-stil klein verwijder">Verwijderen</button></td>
    </tr>`;
  }).join('');

  if (focusSleutel) {
    const rij = $(`#lln-rijen tr[data-id="${CSS.escape(focusSleutel[0])}"]`);
    const el = rij && rij.getElementsByClassName(focusSleutel[1].split(' ').at(-1))[0];
    if (el) el.focus();
  }
}

$('#lln-rijen').addEventListener('change', async e => {
  const rij = e.target.closest('tr');
  if (!rij) return;
  const pad = `klassen/${st.klasId}/leerlingen/${rij.dataset.id}`;
  try {
    if (e.target.classList.contains('niveau')) await update(ref(db, pad), { niveau: e.target.value });
    if (e.target.classList.contains('flits')) await update(ref(db, pad), { flitsTijd: Number(e.target.value) });
  } catch (err) {
    alertInline(foutBericht(err, 'Opslaan'));
  }
});

$('#lln-rijen').addEventListener('click', async e => {
  const knop = e.target.closest('button');
  const rij = e.target.closest('tr');
  if (!knop || !rij) return;
  const id = rij.dataset.id;

  if (knop.classList.contains('kopieer')) {
    const link = oefenlink(id);
    try {
      await navigator.clipboard.writeText(link);
    } catch (err) {
      const tijdelijk = document.createElement('textarea');
      tijdelijk.value = link;
      document.body.append(tijdelijk);
      tijdelijk.select();
      document.execCommand('copy');
      tijdelijk.remove();
    }
    knop.textContent = 'Gekopieerd';
    knop.classList.add('gelukt');
    setTimeout(() => { knop.textContent = 'Kopieer oefenlink'; knop.classList.remove('gelukt'); }, 2000);
    return;
  }

  if (knop.classList.contains('toon-fouten')) {
    st.foutenVan = id;
    tekenLeerlingen();
    tekenFouten();
    $('#fouten').scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  if (knop.classList.contains('verwijder')) {
    const naam = st.leerlingen[id] ? st.leerlingen[id].naam : 'deze leerling';
    bevestigKnop(knop, `Zeker? ${naam} wissen`, async () => {
      try {
        await remove(ref(db, `pogingen/${st.klasId}/${id}`));
        await remove(ref(db, `voortgang/${st.klasId}/${id}`));
        await remove(ref(db, `klassen/${st.klasId}/leerlingen/${id}`));
        if (st.foutenVan === id) { st.foutenVan = null; tekenFouten(); }
      } catch (err) {
        alertInline(foutBericht(err, 'Leerling verwijderen'));
      }
    });
  }
});

// ---------- fouten van één leerling ----------

function tekenFouten() {
  const id = st.foutenVan;
  const lln = id && st.leerlingen[id];
  $('#fouten').hidden = !lln;
  if (!lln) return;

  $('#fouten-titel').textContent = `Fouten van ${lln.naam}`;
  const beurten = beurtenUit(st.pogingen[id]).filter(b => b.uitkomst !== 'g');

  const telling = new Map();
  for (const b of beurten) telling.set(b.woord, (telling.get(b.woord) || 0) + 1);
  const vaak = [...telling].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 10);
  $('#vaak-fout').innerHTML = vaak.length
    ? `<span class="zacht">Vaker fout:</span> ${vaak.map(([w, n]) => `<span class="woordchip">${esc(w)}<b>${n}×</b></span>`).join('')}`
    : '';

  $('#geen-fouten').hidden = beurten.length > 0;
  $('.foutentabel').hidden = beurten.length === 0;
  $('#fouten-rijen').innerHTML = beurten.map(b => {
    const tweedeKlasse = b.uitkomst === 'h' ? 'goed-getypt' : 'fout-getypt';
    const label = b.uitkomst === 'h' ? 'Goed na herkansing' : 'Fout';
    return `<tr>
      <td>${datumTijd(b.tijd)}</td>
      <td class="w">${esc(b.woord)}</td>
      <td class="fout-getypt">${esc(b.eerste) || '–'}</td>
      <td class="${b.tweede ? tweedeKlasse : ''}">${esc(b.tweede) || '–'}</td>
      <td><span class="uitkomst ${b.uitkomst}">${label}</span></td>
    </tr>`;
  }).join('');
}

$('#fouten-sluiten').addEventListener('click', () => {
  st.foutenVan = null;
  tekenLeerlingen();
  tekenFouten();
});
