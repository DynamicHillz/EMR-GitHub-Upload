module.exports = {
  apps: [
    {
      name: 'ssmc-emr-backend',
      script: 'dist/backend/server.js',
      cwd: 'C:\\Users\\WINDOWS11\\Documents\\PythonProject\\St.stephen_EMR',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'ssmc-emr-frontend',
      script: 'start-frontend.js',
      cwd: 'C:\\Users\\WINDOWS11\\Documents\\PythonProject\\St.stephen_EMR',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
