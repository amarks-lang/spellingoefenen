# Spelling oefenen

Flitswoorden oefenen voor groep 4. Een woord staat een paar seconden groot in beeld (op schrijflijnen), verdwijnt, en het kind typt het na. Meteen groen of rood, één herkansing, blokken van 30 woorden met een medaille. Op de leerkrachtpagina staat per leerling wat er fout ging.

- Leerlingen: `https://amarks-lang.github.io/spellingoefenen/` via hun eigen oefenlink (als bladwijzer op de Chromebook)
- Leerkracht: `https://amarks-lang.github.io/spellingoefenen/leerkracht.html`

Statische site op GitHub Pages; Firebase Authentication en Realtime Database voor login en opslag. Geen build-stap: pushen is live.

## Eenmalig instellen in Firebase

1. **Web-app registreren.** Projectinstellingen > Algemeen > Je apps > Web. Zet de SDK-configuratie in `js/config.js`.
2. **Realtime Database aanmaken.** Kies locatie **europe-west1 (België)** en start in vergrendelde modus.
3. **Rules plaatsen.** Realtime Database > Regels: plak de inhoud van `database.rules.json` en publiceer.
   (Of met de CLI: `firebase deploy --only database`.)
4. **Inlogmethodes aanzetten.** Authentication > Sign-in method: **Anoniem** (voor leerlingen) en **Google** (voor de leerkracht).
5. **Domein toestaan.** Authentication > Settings > Authorized domains: voeg `amarks-lang.github.io` toe.

## Hoe het werkt

| Bestand | Wat |
| --- | --- |
| `index.html`, `js/oefenen.js`, `css/oefenen.css` | Leerlingscherm: flitsen, typen, feedback, kralensnoer, medailles |
| `leerkracht.html`, `js/leerkracht.js`, `css/leerkracht.css` | Klassen, leerlingen, niveau en flitstijd, oefenlinks, fouten |
| `js/woorden.js` | Woordenlijsten per niveau: mkm, mkmm, mmkm, mmkmm |
| `js/gedeeld.js` | Hulpfuncties (vergelijken, klascode, pogingen samenvatten) |
| `js/firebase.js`, `js/config.js` | Firebase laden en instellingen |
| `database.rules.json` | Beveiliging van de database |
| `fonts/` | Andika (leerling) en Atkinson Hyperlegible (leerkracht), lokaal zodat er geen Google Fonts nodig is |

Data in de database:

```
klascodes/{code}                 -> klasId
klassen/{klasId}                 naam, eigenaar (uid), eigenaarMail, code,
                                 collegas/{mail}: true, leerlingen/{id}: naam, niveau, flitsTijd
gedeeld/{mail}/{klasId}          true  (zodat een duo-collega haar gedeelde klassen kan vinden)
voortgang/{klasId}/{leerlingId}  blok, woordInBlok, medailles, niveau, blokWoorden, blokUitslag, laatst
pogingen/{klasId}/{leerlingId}/{id}  woord, getypt, goed, poging (1 of 2), niveau, blok, beurt, tijd
```

`{mail}` is het e-mailadres in kleine letters met punten vervangen door komma's
(`duo.collega@levwn.nl` wordt `duo,collega@levwn,nl`), omdat punten niet in een databasesleutel mogen.

### Klas delen met een duo-collega

De eigenaar van een klas vult bij "Gedeeld met" het e-mailadres van de collega in. Na inloggen ziet de collega de klas als tabblad (met het label *gedeeld*) en kan ze leerlingen toevoegen en verwijderen, niveau en flitstijd aanpassen en alle resultaten en fouten zien. Alleen de eigenaar kan collega's toevoegen of weghalen en de klas verwijderen.

- De oefenlink is `…/spellingoefenen/#KLASCODE/leerlingId`. Zonder link kan een kind ook de klascode intypen en de eigen naam kiezen.
- Chromebooks bewaren geen cookies of lokale opslag; daarom staat alle voortgang na elk woord in Firebase.
- Alleen Google-accounts op `@levwn.nl` kunnen een klas aanmaken. Dat staat in `js/config.js` én in `database.rules.json`.
- Kinderen kunnen alleen hun eigen voortgang lezen en pogingen toevoegen, nooit wijzigen of wissen. Alleen de eigenaar van de klas en de collega's met wie de klas gedeeld is zien de pogingen.

## Woorden aanpassen

Pas de lijsten in `js/woorden.js` aan. Houd elke lijst op minstens 30 woorden (één blok). Alleen klankzuivere woorden: geen ei/ij, au/ou, en geen d, b of g aan het eind.
