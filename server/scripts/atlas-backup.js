// Sauvegarde complète de MongoDB Atlas en fichiers JSON (un par collection).
// Filet de sécurité avant migration. Aucune écriture sur Atlas (lecture seule).
//
// Usage:
//   node scripts/atlas-backup.js                -> dossier backups/atlas-YYYY-MM-DD_HHMM
//   node scripts/atlas-backup.js "D:/chemin"    -> dossier de destination personnalisé
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI absent de .env');
    process.exit(1);
  }

  const baseDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(__dirname, '..', '..', 'backups', `atlas-${stamp()}`);
  fs.mkdirSync(baseDir, { recursive: true });

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
    const db = mongoose.connection.db;
    console.log('Connecté à:', db.databaseName);
    console.log('Destination:', baseDir);
    console.log('---');

    const cols = (await db.listCollections().toArray())
      .map((c) => c.name)
      .sort((a, b) => a.localeCompare(b));

    const manifest = { database: db.databaseName, date: new Date().toISOString(), collections: {} };
    let grandTotal = 0;

    for (const name of cols) {
      const docs = await db.collection(name).find({}).toArray();
      const outFile = path.join(baseDir, `${name}.json`);
      // Sérialisation Extended JSON pour préserver ObjectId, Date, etc.
      const ejson = require('mongodb').BSON.EJSON.stringify(docs, null, 2);
      fs.writeFileSync(outFile, ejson);
      manifest.collections[name] = docs.length;
      grandTotal += docs.length;
      console.log(String(docs.length).padStart(8), name);
    }

    manifest.totalDocuments = grandTotal;
    fs.writeFileSync(path.join(baseDir, '_manifest.json'), JSON.stringify(manifest, null, 2));

    console.log('---');
    console.log('Collections:', cols.length, '| Documents:', grandTotal);
    console.log('Backup terminé ->', baseDir);
  } catch (e) {
    console.error('ERREUR:', e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
