module.exports = {
  apps: [
    {
      name: 'bookly',
      script: 'npm',
      args: 'start',
      cwd: '/var/www/bookly',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: '/var/log/bookly/error.log',
      out_file: '/var/log/bookly/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        'public/uploads',
        '.next',
      ],
      max_memory_restart: '500M',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
}
