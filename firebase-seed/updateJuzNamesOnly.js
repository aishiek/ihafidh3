const admin = require('firebase-admin');
const fs = require('fs');
const serviceAccountPath = fs.existsSync('./serviceAccountKey.json') ? './serviceAccountKey.json' : '../firebaseServiceAccountKey.json';
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const JUZ_NAMES = [
  '',
  'Alif Lam Meem',
  'Sayaqool',
  'Tilkal Rusul',
  'Lan Tanaloo',
  'Wal Muhsanat',
  'La Yuhibbullah',
  "Wa Iza Sami'oo",
  'Wa Lau Annana',
  "Qalal Mala'u",
  "Wa'lamoo",
  "Ya'taziroon",
  'Wa Ma Min Dabbatin',
  "Wa Ma Ubabri'u",
  'Rubama',
  'Subhanallazi',
  'Qala Alam',
  'Iqtaraba',
  'Qad Aflaha',
  'Wa Qalallazina',
  'Ammana Khalaqa',
  'Utlu Ma Oohiya',
  'Wa Man Yaqnut',
  'Wa Mali',
  'Faman Azlamu',
  'Ilaihi Yuraddu',
  'Ha Meem',
  'Qala Fama Khatbukum',
  "Qad Sami'allah",
  'Tabarakallazi',
  "‘Amma",
];

async function main() {
  console.log('Updating juz_name and juz_display_name across juz_stats 1-30...\n');
  const batch = db.batch();
  for (let juzNumber = 1; juzNumber <= 30; juzNumber++) {
    const ref = db.collection('juz_stats').doc(String(juzNumber));
    const name = JUZ_NAMES[juzNumber] || '';
    batch.set(
      ref,
      {
        juz_number: juzNumber,
        juz_name: name,
        juz_display_name: `Juz ${juzNumber} (${name})`,
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }
  await batch.commit();
  console.log('✓ Successfully updated all 30 Juz documents in Firestore with their full names!');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to update Juz names:', err);
  process.exit(1);
});
