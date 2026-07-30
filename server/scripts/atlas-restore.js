// Restaure un backup JSON (produit par atlas-backup.js) dans une base MongoDB.
// L'inverse du backup : lit chaque <collection>.json et réinsère les documents.
//
// Usage :
//   node scripts/atlas-restore.js <dossier-backup> [uri-cible]
//
//   <dossier-backup>  dossier contenant les .json (ou un .tar.gz déjà décompressé)
//   [uri-cible]       URI Mongo de destination. Par défaut : MONGO_URI du .env.
//                     ⚠️ Mettre une URI EXPLICITE pour restaurer ailleurs
//                     (ex. un nouveau cluster, ou un Mongo local).
//
// Sécurité : par collection, on VIDE puis on réinsère (restauration fidèle).
// Le script DEMANDE confirmation avant d'écrire (variable FORCE=1 pour sauter).
require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { BSON } = require('mongodb');

function ask(q) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(q, (a) => { rl.close(); res(a); }));
}

(async () => {
  const dir = process.argv[2];
  const uri = process.argv[3] || process.env.MONGO_URI;
  if (!dir || !fs.existsSync(dir)) {
    console.error('Dossier de backup introuvable. Usage: node scripts/atlas-restore.js <dossier> [uri]');
    process.exit(1);
  }
  if (!uri) { console.error('Aucune URI cible (ni argument ni MONGO_URI).'); process.exit(1); }

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== '_manifest.json');
  const target = uri.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
  console.log('Source :', dir, `(${files.length} collections)`);
  console.log('Cible  :', target);

  if (process.env.FORCE !== '1') {
    const a = await ask('\n⚠️  Ceci VIDE puis réécrit ces collections dans la cible. Continuer ? (oui/non) ');
    if (a.trim().toLowerCase() !== 'oui') { console.log('Annulé.'); process.exit(0); }
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
  const db = mongoose.connection.db;
  let total = 0;
  for (const f of files.sort()) {
    const name = path.basename(f, '.json');
    const docs = BSON.EJSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
    total += docs.length;
    console.log(String(docs.length).padStart(8), name);
  }
  console.log('---');
  console.log('Restauration terminée :', total, 'documents dans', db.databaseName);
  await mongoose.disconnect();
})().catch((e) => { console.error('ERREUR:', e.message); process.exit(1); });
