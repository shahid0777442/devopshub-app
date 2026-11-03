'use strict';

// Prometheus text format metrics (koi external library nahi chahiye)
const startedAt = Date.now();
const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5];

const requestCounts = new Map(); // "method|route|status" -> count
const histogram = { buckets: new Array(BUCKETS.length).fill(0), sum: 0, count: 0 };

function observeRequest(method, route, status, seconds) {
  const key = `${method}|${route}|${status}`;
  requestCounts.set(key, (requestCounts.get(key) || 0) + 1);

  BUCKETS.forEach((limit, i) => {
    if (seconds <= limit) histogram.buckets[i] += 1;
  });
  histogram.sum += seconds;
  histogram.count += 1;
}

function render({ tasksTotal, version, env }) {
  const out = [];

  out.push('# HELP devopshub_app_info Application version and environment');
  out.push('# TYPE devopshub_app_info gauge');
  out.push(`devopshub_app_info{version="${version}",env="${env}"} 1`);

  out.push('# HELP devopshub_uptime_seconds Seconds since the app started');
  out.push('# TYPE devopshub_uptime_seconds gauge');
  out.push(`devopshub_uptime_seconds ${((Date.now() - startedAt) / 1000).toFixed(0)}`);

  out.push('# HELP devopshub_tasks_total Number of tasks currently stored');
  out.push('# TYPE devopshub_tasks_total gauge');
  out.push(`devopshub_tasks_total ${tasksTotal}`);

  out.push('# HELP devopshub_http_requests_total Total HTTP requests');
  out.push('# TYPE devopshub_http_requests_total counter');
  for (const [key, value] of requestCounts) {
    const [method, route, status] = key.split('|');
    out.push(`devopshub_http_requests_total{method="${method}",route="${route}",status="${status}"} ${value}`);
  }

  out.push('# HELP devopshub_http_request_duration_seconds HTTP request duration');
  out.push('# TYPE devopshub_http_request_duration_seconds histogram');
  BUCKETS.forEach((limit, i) => {
    out.push(`devopshub_http_request_duration_seconds_bucket{le="${limit}"} ${histogram.buckets[i]}`);
  });
  out.push(`devopshub_http_request_duration_seconds_bucket{le="+Inf"} ${histogram.count}`);
  out.push(`devopshub_http_request_duration_seconds_sum ${histogram.sum}`);
  out.push(`devopshub_http_request_duration_seconds_count ${histogram.count}`);

  return out.join('\n') + '\n';
}

module.exports = { observeRequest, render };
