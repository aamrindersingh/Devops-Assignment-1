const client = require("prom-client");

const registry = new client.Registry();

// Process and nodejs runtime metrics, so the Grafana dashboard has memory
// and event loop lag without writing any of it by hand.
client.collectDefaultMetrics({ register: registry, prefix: "clip_" });

const linksCreated = new client.Counter({
  name: "clip_links_created_total",
  help: "Short links created",
  registers: [registry],
});

// Deliberately NOT labelled by short code. One label value per link would
// make cardinality grow without limit, which is the usual way a Prometheus
// install falls over. The code is in the database if anyone needs it.
const redirects = new client.Counter({
  name: "clip_redirects_total",
  help: "Redirects served for a code that exists",
  registers: [registry],
});

const redirectMisses = new client.Counter({
  name: "clip_redirect_misses_total",
  help: "Requests for a code that does not exist",
  registers: [registry],
});

const rejectedUrls = new client.Counter({
  name: "clip_rejected_urls_total",
  help: "Submissions refused because the URL was not http or https",
  registers: [registry],
});

const linksTotal = new client.Gauge({
  name: "clip_links_total",
  help: "Short links currently stored",
  registers: [registry],
});

const dbUp = new client.Gauge({
  name: "clip_db_up",
  help: "1 when the database answered the last readiness check, 0 otherwise",
  registers: [registry],
});

const httpDuration = new client.Histogram({
  name: "clip_http_request_duration_seconds",
  help: "Request duration by route and status",
  labelNames: ["route", "method", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
});

module.exports = {
  registry, linksCreated, redirects, redirectMisses,
  rejectedUrls, linksTotal, dbUp, httpDuration,
};
