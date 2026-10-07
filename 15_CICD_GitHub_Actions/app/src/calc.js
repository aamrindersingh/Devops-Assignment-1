// Pulled out of the server so the pipeline has something worth unit testing
// that does not need an HTTP listener.
function add(a, b) {
  if (typeof a !== "number" || typeof b !== "number") {
    throw new TypeError("add expects two numbers");
  }
  return a + b;
}

function percentage(part, whole) {
  if (whole === 0) {
    throw new RangeError("cannot take a percentage of zero");
  }
  return Math.round((part / whole) * 100);
}

module.exports = { add, percentage };
