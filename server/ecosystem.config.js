// Configuration PM2 pour le backend KATD-SCHÜLE
// Démarrage :  pm2 start ecosystem.config.js
// Logs     :  pm2 logs katd-api
module.exports = {
  apps: [
    {
      name: 'katd-api',
      script: 'server.js',
      cwd: __dirname,            // /var/www/katd-schule/server
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Les variables sensibles (MONGO_URI, JWT_SECRET, etc.) restent dans .env
      // et sont chargées par dotenv au démarrage de server.js.
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true,
    },
  ],
}
