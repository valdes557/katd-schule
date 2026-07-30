// Vérifie la connexion à MongoDB Atlas et liste les collections + comptes.
// Usage: node scripts/atlas-check.js
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI absent de .env');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    const db = mongoose.connection.db;
    console.log('Connecté à:', db.databaseName);
    const cols = await db.listCollections().toArray();
    let total = 0;
    for (const c of cols.sort((a, b) => a.name.localeCompare(b.name))) {
      const n = await db.collection(c.name).countDocuments();
      total += n;
      console.log(String(n).padStart(8), c.name);
    }
    console.log('---');
    console.log('Collections:', cols.length, '| Documents totaux:', total);
  } catch (e) {
    console.error('ERREUR:', e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
