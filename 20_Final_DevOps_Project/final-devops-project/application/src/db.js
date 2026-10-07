const { Pool } = require("pg");

// Credentials come from the environment, which in Kubernetes is a Secret.
// Nothing here has a default password, so a misconfigured deploy fails
// loudly instead of silently running with a known one.
const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  max: Number(process.env.PG_POOL_MAX || 10),
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 30000,
});

// node-postgres emits an 'error' event on an idle client when the server
// goes away. With no listener, Node treats it as an unhandled error event
// and exits the process. That is exactly wrong here: losing the database
// should make the pod go NotReady, not make it crash and restart. Without
// this handler the liveness probe would kill healthy pods during a
// database blip and turn a short outage into a restart storm.
pool.on("error", (err) => {
  ready = false;
  console.error(`postgres pool error, staying up and reporting not ready: ${err.message}`);
});

let ready = false;

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS links (
      code        TEXT PRIMARY KEY,
      url         TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      hits        BIGINT NOT NULL DEFAULT 0
    )
  `);
  ready = true;
}

// Used by the readiness probe. A cheap query is the only honest way to
// answer "can this pod serve traffic", because the process can be alive
// while the database is gone.
async function isHealthy() {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

async function insertLink(code, url) {
  // ON CONFLICT DO NOTHING lets the caller detect a code collision by
  // checking rowCount, without a race between SELECT and INSERT.
  const r = await pool.query(
    "INSERT INTO links (code, url) VALUES ($1, $2) ON CONFLICT (code) DO NOTHING",
    [code, url]
  );
  return r.rowCount === 1;
}

async function resolveLink(code) {
  // Increment and return in one statement, so two concurrent redirects
  // cannot both read the same hit count and write it back.
  const r = await pool.query(
    "UPDATE links SET hits = hits + 1 WHERE code = $1 RETURNING url",
    [code]
  );
  return r.rows[0] ? r.rows[0].url : null;
}

async function listLinks(limit = 50) {
  const r = await pool.query(
    "SELECT code, url, hits, created_at FROM links ORDER BY created_at DESC LIMIT $1",
    [limit]
  );
  return r.rows;
}

async function deleteLink(code) {
  const r = await pool.query("DELETE FROM links WHERE code = $1", [code]);
  return r.rowCount === 1;
}

async function countLinks() {
  const r = await pool.query("SELECT COUNT(*)::int AS n FROM links");
  return r.rows[0].n;
}

module.exports = {
  pool, init, isHealthy, insertLink, resolveLink,
  listLinks, deleteLink, countLinks,
  isInitialised: () => ready,
};
