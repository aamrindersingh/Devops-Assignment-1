const test = require("node:test");
const assert = require("node:assert");
const { generateCode, isSafeUrl, normalizeUrl, ALPHABET } = require("../src/shorten");

test("generateCode returns a code of the requested length", () => {
  assert.strictEqual(generateCode(7).length, 7);
  assert.strictEqual(generateCode(4).length, 4);
});

test("generateCode only uses the unambiguous alphabet", () => {
  const code = generateCode(16);
  for (const ch of code) assert.ok(ALPHABET.includes(ch), `unexpected character ${ch}`);
});

test("generateCode leaves out characters that are easy to misread", () => {
  for (const ch of ["0", "O", "1", "l", "I"]) {
    assert.ok(!ALPHABET.includes(ch), `${ch} should not be in the alphabet`);
  }
});

test("generateCode rejects a silly length", () => {
  assert.throws(() => generateCode(2), RangeError);
  assert.throws(() => generateCode(64), RangeError);
  assert.throws(() => generateCode(7.5), RangeError);
});

test("generateCode is deterministic when the rng is", () => {
  const fixed = () => 0;
  assert.strictEqual(generateCode(5, fixed), ALPHABET[0].repeat(5));
});

test("isSafeUrl accepts ordinary http and https links", () => {
  assert.ok(isSafeUrl("https://github.com/aamrindersingh/Devops-Assignment-1"));
  assert.ok(isSafeUrl("http://example.com/a/b?c=d#e"));
});

test("isSafeUrl rejects the schemes that make a redirect dangerous", () => {
  assert.ok(!isSafeUrl("javascript:alert(document.cookie)"));
  assert.ok(!isSafeUrl("data:text/html;base64,PHNjcmlwdD4="));
  assert.ok(!isSafeUrl("file:///etc/passwd"));
});

test("isSafeUrl rejects a scheme relative url", () => {
  // "//evil.com" would inherit the current scheme and silently work in a
  // browser, which is the subtle version of this bug.
  assert.ok(!isSafeUrl("//evil.com"));
});

test("isSafeUrl rejects junk and oversized input", () => {
  assert.ok(!isSafeUrl(""));
  assert.ok(!isSafeUrl("not a url"));
  assert.ok(!isSafeUrl(null));
  assert.ok(!isSafeUrl(42));
  assert.ok(!isSafeUrl("https://example.com/" + "a".repeat(3000)));
});

test("normalizeUrl returns a canonical url and throws on anything unsafe", () => {
  assert.strictEqual(normalizeUrl("https://example.com"), "https://example.com/");
  assert.throws(() => normalizeUrl("javascript:alert(1)"), TypeError);
});
