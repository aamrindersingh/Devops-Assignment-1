const test = require("node:test");
const assert = require("node:assert");
const { add, percentage } = require("../src/calc");

test("add returns the sum of two numbers", () => {
  assert.strictEqual(add(2, 3), 5);
  assert.strictEqual(add(-1, 1), 0);
});

test("add rejects anything that is not a number", () => {
  assert.throws(() => add("2", 3), TypeError);
});

test("percentage rounds to the nearest whole number", () => {
  assert.strictEqual(percentage(1, 3), 33);
  assert.strictEqual(percentage(2, 3), 67);
});

test("percentage refuses to divide by zero", () => {
  assert.throws(() => percentage(1, 0), RangeError);
});
