import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

// Password storage format: random 16-byte salt (hex) : 64-byte scrypt hash (hex).
// Storing a hash instead of the original password protects users if the DB is read.
export async function hashPassword(password) {
    const salt = randomBytes(16).toString("hex");
    const hash = await scrypt(password, salt, 64);
    return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password, storedPassword) {
    if (typeof storedPassword !== "string") return false;

    const parts = storedPassword.split(":");
    if (parts.length !== 2 || !/^[a-f0-9]{32}$/i.test(parts[0]) || !/^[a-f0-9]{128}$/i.test(parts[1])) {
        return false;
    }

    const actual = Buffer.from(parts[1], "hex");
    const supplied = await scrypt(password, parts[0], actual.length);
    return timingSafeEqual(actual, supplied);
}
