'use strict';

// Structured (JSON) logging - Docker logs / Grafana Loki / ELK in sab ke liye easy hai
function write(level, message, extra = {}) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    app: 'devopshub-app',
    message,
    ...extra,
  });
  if (level === 'error') console.error(line);
  else console.log(line);
}

module.exports = {
  info: (message, extra) => write('info', message, extra),
  warn: (message, extra) => write('warn', message, extra),
  error: (message, extra) => write('error', message, extra),
};
