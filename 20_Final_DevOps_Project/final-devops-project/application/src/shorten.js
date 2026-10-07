// Pure logic, no database and no HTTP, so it can be unit tested on its own.

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// 0/O and 1/l/I are left out. Short codes get read aloud and typed by hand,
// and those are the characters people get wrong.

const MAX_URL_LENGTH = 2048;

function generateCode(length = 7, rng = Math.random) {
  if (!Number.isInteger(length) || length < 4 || length > 16) {
    throw new RangeError("code length must be an integer between 4 and 16");
  }
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  }
  return out;
}

// The security control for this whole application lives here.
//
// A shortener exists to redirect to user supplied URLs, so the redirect
// itself can never be "fixed". What stops it being an open redirect to
// anything dangerous is refusing to store a URL that is not plain http or
// https in the first place. javascript: and data: URLs are the ones that
// turn a redirect into script execution in the visitor's browser.
function isSafeUrl(input) {
  if (typeof input !== "string" || input.length === 0) return false;
  if (input.length > MAX_URL_LENGTH) return false;

  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return false; // not a URL at all, including scheme relative "//evil.com"
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (!parsed.hostname) return false;

  return true;
}

function normalizeUrl(input) {
  if (!isSafeUrl(input)) {
    throw new TypeError("url must be an http or https address");
  }
  return new URL(input).toString();
}

module.exports = { generateCode, isSafeUrl, normalizeUrl, ALPHABET, MAX_URL_LENGTH };
