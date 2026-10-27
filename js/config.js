// Firebase-instellingen van dit project.
// Te vinden in de Firebase-console: Projectinstellingen > Algemeen > Je apps > Web-app > SDK-configuratie.
// Deze waarden zijn niet geheim; de beveiliging zit in database.rules.json.
export const firebaseConfig = {
  apiKey: 'AIzaSyCtfSuRJti4r0kI8erOCStYRPY9IbxN2eo',
  authDomain: 'spellingoefenen.firebaseapp.com',
  databaseURL: 'https://spellingoefenen-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'spellingoefenen',
  appId: '1:252696190648:web:4c5e75406686c2ddf3de4d'
};

// Alleen Google-accounts met dit e-maildomein kunnen een klas aanmaken.
// Staat ook in database.rules.json; pas ze allebei aan als dit verandert.
export const LEERKRACHT_DOMEIN = 'levwn.nl';
