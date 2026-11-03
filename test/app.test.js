'use strict';

const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/app');
const tasks = require('../src/tasks');

let server;
let baseUrl;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://localhost:${server.address().port}`;
});

after(() => new Promise((resolve) => {
  server.closeAllConnections();
  server.close(resolve);
}));

beforeEach(() => tasks.reset());

test('GET /health returns ok', async () => {
  const res = await fetch(`${baseUrl}/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.status, 'ok');
  assert.ok(body.version);
});

test('GET / serves the web UI', async () => {
  const res = await fetch(`${baseUrl}/`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /DevOpsHub/);
});

test('POST /api/tasks creates a task', async () => {
  const res = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Setup CI pipeline' }),
  });
  const task = await res.json();
  assert.equal(res.status, 201);
  assert.equal(task.title, 'Setup CI pipeline');
  assert.equal(task.done, false);
});

test('POST /api/tasks without title returns 400', async () => {
  const res = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
});

test('toggle and delete a task', async () => {
  const created = await (
    await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Deploy to staging' }),
    })
  ).json();

  const toggled = await (await fetch(`${baseUrl}/api/tasks/${created.id}/toggle`, { method: 'PUT' })).json();
  assert.equal(toggled.done, true);

  const del = await fetch(`${baseUrl}/api/tasks/${created.id}`, { method: 'DELETE' });
  assert.equal(del.status, 200);

  const list = await (await fetch(`${baseUrl}/api/tasks`)).json();
  assert.equal(list.length, 0);
});

test('unknown task returns 404', async () => {
  const res = await fetch(`${baseUrl}/api/tasks/999/toggle`, { method: 'PUT' });
  assert.equal(res.status, 404);
});

test('GET /metrics exposes prometheus metrics', async () => {
  await fetch(`${baseUrl}/health`);
  const res = await fetch(`${baseUrl}/metrics`);
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.match(text, /devopshub_http_requests_total/);
  assert.match(text, /devopshub_tasks_total/);
  assert.match(text, /devopshub_http_request_duration_seconds_count/);
});
