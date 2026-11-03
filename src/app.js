'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const logger = require('./logger');
const metrics = require('./metrics');
const tasks = require('./tasks');
const pkg = require('../package.json');

const INDEX_HTML = path.join(__dirname, '..', 'public', 'index.html');

const appInfo = () => ({
  version: process.env.APP_VERSION || pkg.version,
  env: process.env.APP_ENV || 'development',
});

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
  });
  res.end(data);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function route(req, res, ctx) {
  const { pathname } = new URL(req.url, 'http://localhost');
  const method = req.method;

  if (method === 'GET' && pathname === '/') {
    ctx.route = '/';
    const html = fs.readFileSync(INDEX_HTML);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(html);
  }

  if (method === 'GET' && pathname === '/health') {
    ctx.route = '/health';
    return sendJson(res, 200, {
      status: 'ok',
      ...appInfo(),
      uptimeSeconds: Math.round(process.uptime()),
    });
  }

  if (method === 'GET' && pathname === '/metrics') {
    ctx.route = '/metrics';
    const body = metrics.render({ tasksTotal: tasks.count(), ...appInfo() });
    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    return res.end(body);
  }

  if (pathname === '/api/tasks') {
    ctx.route = '/api/tasks';
    if (method === 'GET') return sendJson(res, 200, tasks.list());
    if (method === 'POST') {
      const body = await readJsonBody(req);
      const title = typeof body.title === 'string' ? body.title.trim() : '';
      if (!title) return sendJson(res, 400, { error: 'title is required' });
      return sendJson(res, 201, tasks.create(title));
    }
  }

  const match = pathname.match(/^\/api\/tasks\/(\d+)(\/toggle)?$/);
  if (match) {
    const id = Number(match[1]);
    if (match[2] && method === 'PUT') {
      ctx.route = '/api/tasks/:id/toggle';
      const task = tasks.toggle(id);
      return task ? sendJson(res, 200, task) : sendJson(res, 404, { error: 'task not found' });
    }
    if (!match[2] && method === 'DELETE') {
      ctx.route = '/api/tasks/:id';
      return tasks.remove(id)
        ? sendJson(res, 200, { deleted: id })
        : sendJson(res, 404, { error: 'task not found' });
    }
  }

  ctx.route = 'not_found';
  return sendJson(res, 404, { error: 'not found' });
}

function createServer() {
  return http.createServer(async (req, res) => {
    const startedAt = process.hrtime.bigint();
    const ctx = { route: 'unknown' };

    res.on('finish', () => {
      const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
      metrics.observeRequest(req.method, ctx.route, res.statusCode, seconds);
      if (ctx.route !== '/metrics' && ctx.route !== '/health') {
        logger.info('request', {
          method: req.method,
          route: ctx.route,
          status: res.statusCode,
          durationMs: Math.round(seconds * 1000),
        });
      }
    });

    try {
      await route(req, res, ctx);
    } catch (err) {
      const isClientError = err.message === 'Invalid JSON' || err.message === 'Body too large';
      if (!isClientError) logger.error('unhandled error', { error: err.message });
      if (!res.headersSent) sendJson(res, isClientError ? 400 : 500, { error: err.message });
    }
  });
}

module.exports = { createServer };
