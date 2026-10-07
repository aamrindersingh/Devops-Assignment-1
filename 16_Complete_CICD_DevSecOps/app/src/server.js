const express = require("express");
const { users, findById, safeName } = require("./users");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("<h1>DevSecOps demo</h1>");
});

app.get("/healthz", (req, res) => res.json({ status: "ok" }));
app.get("/ready", (req, res) => res.json({ ready: true }));

app.get("/users", (req, res) => res.json(users));

app.get("/users/:id", (req, res) => {
  const user = findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: "not found" });
  }
  res.json(user);
});

// Escapes the input rather than echoing it straight back, so the SAST
// scan has nothing to flag here.
app.get("/greet", (req, res) => {
  try {
    res.send(`<p>Hello, ${safeName(String(req.query.name || "guest"))}</p>`);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`listening on ${PORT}`));
}

module.exports = app;
