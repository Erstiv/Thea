module.exports = {
  apps: [{
    name: 'thea-panel',
    script: 'server/index.js',
    cwd: '/var/www/thea-panel',
    env: {
      NODE_ENV: 'production',
      PORT: 3005,
    },
    instances: 1,
    autorestart: true,
    max_memory_restart: '256M',
  }],
};
