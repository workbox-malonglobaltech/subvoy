// PM2 process config for the Subvoy backend API.
// The frontend is a static Vite build (frontend/dist) — serve it with nginx or
// any static host; PM2 only runs the Node API here.
//
// Used by .github/workflows/deploy.yml:
//   pm2 reload subvoy-backend --update-env || pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'subvoy-backend',
      cwd: './backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      // The app loads ../.env via dotenv (see backend/src/index.ts), so keep the
      // .env file at the repo root on the server.
      max_memory_restart: '300M',
      out_file: './logs/backend-out.log',
      error_file: './logs/backend-err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
