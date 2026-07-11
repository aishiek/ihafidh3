import * as admin from 'firebase-admin';
import * as path from 'path';

const serviceAccountPath = path.join(__dirname, '../firebaseServiceAccountKey.json');
const serviceAccount = require(serviceAccountPath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkStats() {
  try {
    console.log('Checking /community_stats/global ...');
    const globalDoc = await db.collection('community_stats').doc('global').get();
    if (globalDoc.exists) {
      console.log('Global doc exists:', JSON.stringify(globalDoc.data(), null, 2));
    } else {
      console.log('Global doc DOES NOT EXIST');
    }

    console.log('\nChecking /surah_stats count ...');
    const surahSnapshot = await db.collection('surah_stats').get();
    console.log(`surah_stats doc count: ${surahSnapshot.size}`);
    if (surahSnapshot.size > 0) {
      console.log('Sample surah_stat (doc 1):', JSON.stringify(surahSnapshot.docs[0].data(), null, 2));
    }

    console.log('\nChecking /juz_stats count ...');
    const juzSnapshot = await db.collection('juz_stats').get();
    console.log(`juz_stats doc count: ${juzSnapshot.size}`);
    if (juzSnapshot.size > 0) {
      console.log('Sample juz_stat (doc 1):', JSON.stringify(juzSnapshot.docs[0].data(), null, 2));
    }
  } catch (err) {
    console.error('Error querying Firestore:', err);
  }
}

checkStats();
