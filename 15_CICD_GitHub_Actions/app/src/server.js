const express = require("express");
const { add, percentage } = require("./calc");

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || "dev";

app.get("/", (req, res) => {
  res.send(`<h1>CI/CD demo</h1><p>Version: ${VERSION}</p>`);
});

// Kubernetes probes hit these two.
app.get("/healthz", (req, res) => res.json({ status: "ok" }));
app.get("/ready", (req, res) => res.json({ ready: true }));

app.get("/add", (req, res) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  try {
    res.json({ result: add(a, b) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`listening on ${PORT}, version ${VERSION}`));
}

module.exports = { app, add, percentage };
