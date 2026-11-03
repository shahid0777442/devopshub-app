'use strict';

const { createServer } = require('./app');
const logger = require('./logger');

const PORT = Number(process.env.PORT) || 3000;
const server = createServer();

server.listen(PORT, () => {
  logger.info('server started', {
    port: PORT,
    env: process.env.APP_ENV || 'development',
    version: process.env.APP_VERSION || 'local',
  });
});

// Graceful shutdown - Docker stop / deploy ke waqt zaroori hai
function shutdown(signal) {
  logger.info('shutting down', { signal });
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
