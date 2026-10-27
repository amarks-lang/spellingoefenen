// Woordenlijsten per niveau.
// Indeling op klanken, niet op letters: "boos" en "maan" zijn ook mkm.
// Alleen klankzuivere woorden (je schrijft wat je hoort): geen ei/ij, au/ou,
// geen d/b aan het eind (hond, krab) en geen g aan het eind (dag).
// Andere woorden nodig? Pas de lijst hieronder aan; elke lijst heeft minstens 30 woorden.

export const NIVEAUS = {
  mkm: {
    label: 'mkm',
    voorbeeld: 'bos',
    woorden: [
      // a
      'bal', 'bak', 'dak', 'gat', 'jas', 'kam', 'kap', 'kar', 'kat', 'lam', 'map',
      'man', 'mat', 'nat', 'pak', 'pan', 'rat', 'sap', 'tak', 'tas', 'vat', 'zak',
      // e
      'bek', 'bel', 'hek', 'lek', 'mes', 'nek', 'pen', 'pet', 'rem', 'vel', 'zes', 'net',
      // i
      'kip', 'kin', 'lip', 'pit', 'pin', 'rit', 'tik', 'tip', 'vis', 'wip', 'wit', 'zit', 'zin', 'lik',
      // o
      'bos', 'dop', 'hok', 'kok', 'kom', 'kop', 'mol', 'mos', 'pop', 'pot', 'rok', 'rol',
      'sok', 'tol', 'top', 'vos', 'zon', 'bot',
      // u
      'bus', 'dun', 'hut', 'kus', 'lus', 'mus', 'nul', 'pup', 'put', 'zus',
      // aa
      'baan', 'haan', 'haar', 'haas', 'jaar', 'kaas', 'maan', 'naam', 'raam', 'vaas', 'zaal', 'paal', 'maat',
      // ee
      'been', 'beer', 'meer', 'peer', 'teen', 'veer', 'weer', 'zeep', 'neef', 'keel',
      // oo
      'boom', 'boos', 'boot', 'doos', 'hoop', 'kool', 'noot', 'poot', 'room', 'roos', 'rook', 'zoon', 'boor',
      // uu
      'buur', 'duur', 'muur', 'vuur', 'zuur', 'huur',
      // oe
      'boek', 'boer', 'doek', 'doel', 'hoek', 'koek', 'poes', 'roep', 'soep', 'voet', 'zoek', 'voer',
      // ie
      'biet', 'dier', 'mier', 'riem', 'riet', 'vies', 'wiel', 'ziek', 'lief', 'diep', 'niet',
      // eu
      'deur', 'deuk', 'heup', 'leuk', 'neus', 'reus', 'geur',
      // ui
      'buik', 'duim', 'huis', 'kuil', 'luis', 'muis', 'ruit', 'tuin', 'buis'
    ]
  },
  mkmm: {
    label: 'mkmm',
    voorbeeld: 'kast',
    woorden: [
      'kast', 'kist', 'lamp', 'tent', 'bank', 'help', 'melk', 'wolk', 'half', 'park',
      'kerk', 'berk', 'hert', 'kort', 'wesp', 'vork', 'dorp', 'kurk', 'muts', 'rups',
      'pols', 'hals', 'tulp', 'pomp', 'wolf', 'golf', 'rots', 'nest', 'test', 'vest',
      'post', 'kust', 'bult', 'gans', 'dans', 'kans', 'lint', 'mint', 'punt', 'munt',
      'gips', 'kamp', 'jurk', 'werk', 'kers', 'film', 'palm', 'helm', 'warm', 'worm',
      'pink', 'zink', 'tank', 'vonk', 'kalf', 'kaart', 'paars', 'taart', 'maart', 'feest',
      'beest', 'kaars', 'poort', 'fiets', 'hoorn', 'buurt'
    ]
  },
  mmkm: {
    label: 'mmkm',
    voorbeeld: 'stok',
    woorden: [
      'stok', 'stip', 'stal', 'stam', 'stop', 'step', 'snor', 'slak', 'slim', 'slot',
      'smal', 'snel', 'spin', 'spek', 'spel', 'stuk', 'stil', 'stem', 'glas', 'gras',
      'klok', 'knop', 'kruk', 'klap', 'klas', 'klem', 'klim', 'klop', 'plas', 'plat',
      'plek', 'plus', 'pluk', 'prop', 'prik', 'bril', 'brok', 'brul', 'drop', 'trap',
      'trek', 'tram', 'trom', 'vlek', 'vlot', 'vlam', 'fles', 'stof', 'spat', 'klep',
      'fluit', 'kruis', 'kraan', 'steen', 'sloot', 'stoel', 'stoep', 'snoep', 'kroon', 'troon',
      'spook', 'draak', 'droom', 'bloem', 'broek', 'vloer', 'slang', 'stier', 'groen', 'klaar',
      'plaat', 'brief', 'kleur', 'spoor', 'stoer', 'slaap'
    ]
  },
  mmkmm: {
    label: 'mmkmm',
    voorbeeld: 'storm',
    woorden: [
      'storm', 'sterk', 'staart', 'drank', 'drink', 'klomp', 'kramp', 'krant', 'plant', 'sport',
      'start', 'stomp', 'slank', 'slurf', 'stank', 'spons', 'plank', 'trots', 'prins', 'glans',
      'krans', 'krimp', 'blank', 'flink', 'prent', 'plaats', 'kwast', 'zwart', 'troost', 'klets',
      'plons', 'spits', 'krent', 'kwark', 'spurt', 'klant', 'slurp', 'grens', 'kwart'
    ]
  }
};

export const NIVEAU_VOLGORDE = ['mkm', 'mkmm', 'mmkm', 'mmkmm'];
