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

// Semgrep flagged the first version of this handler, which built an HTML
// string out of req.query.name and passed it to res.send. I had written a
// safeName() helper to strip dangerous characters, but a scanner cannot
// tell that my helper is a real sanitizer, and more to the point it was
// right that hand building HTML from user input is the risky pattern.
// Returning JSON removes the HTML sink altogether, so there is nothing to
// escape and nothing to get wrong later.
app.get("/greet", (req, res) => {
  try {
    res.json({ greeting: `Hello, ${safeName(String(req.query.name || "guest"))}` });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`listening on ${PORT}`));
}

module.exports = app;
