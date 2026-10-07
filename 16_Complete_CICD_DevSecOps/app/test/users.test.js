const test = require("node:test");
const assert = require("node:assert");
const { findById, safeName } = require("../src/users");

test("findById returns the matching user", () => {
  assert.strictEqual(findById(1).name, "amrinder");
  assert.strictEqual(findById("2").name, "test-user");
});

test("findById returns undefined for an unknown id", () => {
  assert.strictEqual(findById(99), undefined);
});

test("safeName strips characters that could break out into HTML", () => {
  assert.strictEqual(safeName("<script>alert(1)</script>"), "scriptalert(1)/script");
  assert.strictEqual(safeName("amrinder"), "amrinder");
});

test("safeName rejects a non string", () => {
  assert.throws(() => safeName(42), TypeError);
});
