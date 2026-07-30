// Liste TOUTES les bases du cluster Atlas + nb de documents users dans chacune.
// Sert à vérifier si un compte "disparu" est en fait dans une autre base.
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error('MONGO_URI absent'); process.exit(1); }
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });
    const admin = mongoose.connection.db.admin();
    const { databases } = await admin.listDatabases();
    console.log('Base actuelle (dans MONGO_URI):', mongoose.connection.db.databaseName);
    console.log('---');
    for (const d of databases) {
      let info = '';
      try {
        const conn = mongoose.connection.useDb(d.name);
        const cols = await conn.db.listCollections().toArray();
        const hasUsers = cols.find((c) => c.name === 'users');
        if (hasUsers) {
          const n = await conn.db.collection('users').countDocuments();
          info = ` | users=${n}`;
        }
      } catch (e) { info = ' | (lecture impossible)'; }
      console.log(d.name.padEnd(24), `${(d.sizeOnDisk/1024/1024).toFixed(1)}Mo`.padStart(10), info);
    }
  } catch (e) {
    console.error('ERREUR:', e.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
})();
