const express = require("express");
const db = require("./db");
const M = require("./metrics");
const { generateCode, normalizeUrl, isSafeUrl } = require("./shorten");

const app = express();
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));

// Config comes from a ConfigMap, secrets from a Secret. Nothing sensitive
// has a default.
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const CODE_LENGTH = Number(process.env.CODE_LENGTH || 7);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

// Time every request into a histogram, labelled by the route pattern
// rather than the actual path, so /abc123 and /xyz789 share one series.
app.use((req, res, next) => {
  const end = M.httpDuration.startTimer();
  res.on("finish", () => {
    const route = req.route ? req.route.path : (req.path === "/" ? "/" : "/:code");
    end({ route, method: req.method, status: res.statusCode });
  });
  next();
});

app.get("/", async (req, res) => {
  let count = "?";
  try { count = await db.countLinks(); } catch { /* UI still renders without it */ }
  res.type("html").send(`<!doctype html>
<meta charset="utf-8"><title>clip</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:3rem auto;padding:0 1rem}
input,button{font:inherit;padding:.5rem}input{width:70%}code{background:#eee;padding:.1rem .3rem}</style>
<h1>clip</h1>
<p>Short links for long college URLs. ${count} stored.</p>
<form method="post" action="/api/links">
  <input name="url" placeholder="https://docs.google.com/forms/d/e/1FAIpQLS..." required>
  <button>Shorten</button>
</form>
<p><a href="/api/links">All links (JSON)</a></p>`);
});

// Liveness. Answers as long as the process is running. It deliberately does
// NOT touch the database: if it did, a database outage would make kubelet
// restart every healthy pod, which makes the outage worse.
app.get("/healthz", (req, res) => res.json({ status: "ok" }));

// Readiness. Does touch the database, because a pod that cannot reach it
// cannot serve a redirect and should be taken out of the Service.
app.get("/ready", async (req, res) => {
  const ok = await db.isHealthy();
  M.dbUp.set(ok ? 1 : 0);
  if (!ok) return res.status(503).json({ ready: false, reason: "database unreachable" });
  res.json({ ready: true });
});

app.get("/metrics", async (req, res) => {
  try { M.linksTotal.set(await db.countLinks()); } catch { /* keep last value */ }
  res.set("Content-Type", M.registry.contentType);
  res.send(await M.registry.metrics());
});

app.post("/api/links", async (req, res) => {
  const raw = (req.body && req.body.url) || "";
  if (!isSafeUrl(raw)) {
    M.rejectedUrls.inc();
    return res.status(400).json({ error: "url must be an http or https address" });
  }
  const url = normalizeUrl(raw);

  // Retry on the unlikely case of a code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(CODE_LENGTH);
    if (await db.insertLink(code, url)) {
      M.linksCreated.inc();
      return res.status(201).json({ code, short: `${BASE_URL}/${code}`, url });
    }
  }
  res.status(500).json({ error: "could not allocate a free code, try again" });
});

app.get("/api/links", async (req, res) => {
  res.json(await db.listLinks());
});

app.delete("/api/links/:code", async (req, res) => {
  if (!ADMIN_TOKEN || req.get("x-admin-token") !== ADMIN_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const gone = await db.deleteLink(req.params.code);
  res.status(gone ? 204 : 404).end();
});

// The redirect. This is the route a scanner flags as an open redirect, and
// it is correct that it does: the destination is user supplied. The control
// is at the write path, in isSafeUrl, which refuses to store anything that
// is not http or https. See security/README.md.
app.get("/:code", async (req, res) => {
  const url = await db.resolveLink(req.params.code);
  if (!url) {
    M.redirectMisses.inc();
    return res.status(404).type("html").send("<h1>404</h1><p>No such link.</p>");
  }
  M.redirects.inc();
  res.redirect(302, url);
});

async function start() {
  // Retry, because on a fresh deploy the app and the database start at the
  // same time and Postgres usually loses that race.
  for (let i = 1; i <= 30; i++) {
    try { await db.init(); break; }
    catch (err) {
      console.log(`waiting for database (${i}/30): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  app.listen(PORT, () => console.log(`clip listening on ${PORT}, base ${BASE_URL}`));
}

if (require.main === module) start();

module.exports = app;
