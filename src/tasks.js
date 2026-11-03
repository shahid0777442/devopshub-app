'use strict';

// Simple in-memory store (demo ke liye). Production mein yahan database aayega.
let tasks = [];
let nextId = 1;

function list() {
  return tasks;
}

function create(title) {
  const task = { id: nextId++, title, done: false, createdAt: new Date().toISOString() };
  tasks.push(task);
  return task;
}

function toggle(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return null;
  task.done = !task.done;
  return task;
}

function remove(id) {
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) return false;
  tasks.splice(index, 1);
  return true;
}

function count() {
  return tasks.length;
}

function reset() {
  tasks = [];
  nextId = 1;
}

module.exports = { list, create, toggle, remove, count, reset };
