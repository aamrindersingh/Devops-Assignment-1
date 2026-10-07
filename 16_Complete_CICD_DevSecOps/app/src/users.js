const _ = require("lodash");

// Tiny in-memory store. The interesting part for this session is not the
// logic, it is that lodash is pinned to an old version on purpose so the
// dependency scan has a real finding to report.
const users = [
  { id: 1, name: "amrinder", role: "admin" },
  { id: 2, name: "test-user", role: "viewer" },
];

function findById(id) {
  return _.find(users, (u) => u.id === Number(id));
}

function safeName(input) {
  if (typeof input !== "string") {
    throw new TypeError("name must be a string");
  }
  // Strip the characters that would let a name break out into HTML.
  return input.replace(/[<>&"'`]/g, "");
}

module.exports = { users, findById, safeName };
