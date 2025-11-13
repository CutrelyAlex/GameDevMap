module.exports = {
  apps: [{
    name: 'gamedevmap-api',
    script: 'server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: '/www/wwwlogs/8.163.12.243.error.log',
    out_file: '/www/wwwlogs/8.163.12.243.out.log',
    log_file: '/www/wwwlogs/8.163.12.243.log',
    time: true
  }]
};