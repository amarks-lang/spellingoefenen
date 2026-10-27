// Kleine hulpfuncties die leerling- en leerkrachtpagina allebei gebruiken.

export const BLOK_GROOTTE = 30;
export const FLITSTIJDEN = [2, 3, 4, 5, 6, 8];
export const STANDAARD_FLITSTIJD = 4;

// Wat het kind typt vergelijken we zonder hoofdletters en zonder spaties aan begin/eind.
export function normaliseer(tekst) {
  return String(tekst || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Klascode: 6 tekens, zonder letters die op cijfers lijken (geen 0/O, 1/I/L).
const CODE_TEKENS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function maakCode() {
  const r = new Uint32Array(6);
  crypto.getRandomValues(r);
  return Array.from(r, n => CODE_TEKENS[n % CODE_TEKENS.length]).join('');
}

export function schud(lijst) {
  const a = lijst.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function esc(tekst) {
  return String(tekst ?? '').replace(/[&<>"']/g, t => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[t]);
}

// Pogingen van één leerling samenvatten per beurt (één woord in een blok).
// uitkomst: 'g' = in één keer goed, 'h' = goed na herkansing, 'f' = fout.
export function beurtenUit(pogingenObj) {
  const perBeurt = new Map();
  for (const p of Object.values(pogingenObj || {})) {
    if (!p || !p.beurt) continue;
    if (!perBeurt.has(p.beurt)) perBeurt.set(p.beurt, []);
    perBeurt.get(p.beurt).push(p);
  }
  const beurten = [];
  for (const [beurt, lijst] of perBeurt) {
    lijst.sort((a, b) => (a.tijd || 0) - (b.tijd || 0));
    const p1 = lijst.filter(p => p.poging === 1).at(-1);
    const p2 = lijst.filter(p => p.poging === 2).at(-1);
    const eerste = p1 || lijst[0];
    let uitkomst = 'f';
    if (p1 && p1.goed) uitkomst = 'g';
    else if (p2 && p2.goed) uitkomst = 'h';
    beurten.push({
      beurt,
      woord: eerste.woord,
      niveau: eerste.niveau,
      eerste: p1 ? p1.getypt : '',
      tweede: p2 ? p2.getypt : '',
      uitkomst,
      tijd: lijst.at(-1).tijd || 0
    });
  }
  beurten.sort((a, b) => b.tijd - a.tijd);
  return beurten;
}
