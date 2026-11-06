import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { hashPassword, verifyPassword } from "./passwords.ts";

describe("passwords", () => {
  test("only the right password matches its hash", () => {
    const stored = hashPassword("una-clave-de-prueba");
    assert.equal(verifyPassword("una-clave-de-prueba", stored), true);
    assert.equal(verifyPassword("otra-clave", stored), false);
  });

  test("the hash never contains the password and changes every time", () => {
    const first = hashPassword("una-clave-de-prueba");
    assert.ok(!first.includes("una-clave-de-prueba"));
    assert.notEqual(first, hashPassword("una-clave-de-prueba"));
    // No "$": Next.js would try to expand it inside .env files.
    assert.ok(!first.includes("$"));
  });

  test("a missing or malformed hash never lets anyone in", () => {
    assert.equal(verifyPassword("x", undefined), false);
    assert.equal(verifyPassword("x", ""), false);
    assert.equal(verifyPassword("x", "scrypt:abc"), false);
    assert.equal(verifyPassword("x", "texto-plano"), false);
  });
});
