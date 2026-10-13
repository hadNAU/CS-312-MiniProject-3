import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../lib/passwords.js";

test("hashing creates salted, different password hashes", async () => {
    const first = await hashPassword("A secure password!");
    const second = await hashPassword("A secure password!");
    assert.notEqual(first, second);
    assert.equal(first.length, 161);
    assert.equal(await verifyPassword("A secure password!", first), true);
    assert.equal(await verifyPassword("wrong password", first), false);
});

test("invalid stored password cannot authenticate", async () => {
    assert.equal(await verifyPassword("anything", "not-a-hash"), false);
    assert.equal(await verifyPassword("anything", null), false);
});
