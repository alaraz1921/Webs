import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { randomBytes, generateKeyPairSync } from "node:crypto";
import { encryptFile, decryptFile, sha256, PROJECT } from "./remote-backup.mjs";
const pair = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});
async function temporary(fn) {
  const dir = await fs.mkdtemp(join(tmpdir(), "fintin-crypto-test-"));
  try {
    await fn(dir);
  } finally {
    assert.ok(
      resolve(dir).startsWith(resolve(tmpdir()) + sep + "fintin-crypto-test-"),
    );
    await fs.rm(dir, { recursive: true, force: true });
  }
}
test("cifra y recupera todos los bytes con hash autenticado", () =>
  temporary(async (dir) => {
    const source = join(dir, "source"),
      sealed = join(dir, "sealed"),
      restored = join(dir, "restored");
    const bytes = randomBytes(2 * 1024 * 1024 + 13);
    await fs.writeFile(source, bytes);
    const encrypted = await encryptFile(source, sealed, pair.publicKey);
    assert.equal(encrypted.project, PROJECT);
    await decryptFile(sealed, restored, pair.privateKey);
    assert.equal(await sha256(source), await sha256(restored));
    assert.deepEqual(await fs.readFile(restored), bytes);
  }));
test("rechaza manipulación sin dejar un archivo recuperado parcial", () =>
  temporary(async (dir) => {
    const source = join(dir, "source"),
      sealed = join(dir, "sealed"),
      restored = join(dir, "restored");
    await fs.writeFile(source, "datos sintéticos");
    await encryptFile(source, sealed, pair.publicKey);
    const bytes = await fs.readFile(sealed);
    bytes[bytes.length - 18] ^= 1;
    await fs.writeFile(sealed, bytes);
    await assert.rejects(decryptFile(sealed, restored, pair.privateKey));
    await assert.rejects(fs.access(restored));
    await assert.rejects(fs.access(restored + ".partial"));
  }));
test("rechaza truncamientos y cabeceras desconocidas", () =>
  temporary(async (dir) => {
    const source = join(dir, "source"),
      sealed = join(dir, "sealed");
    await fs.writeFile(source, "sintético");
    await encryptFile(source, sealed, pair.publicKey);
    const bytes = await fs.readFile(sealed);
    await fs.writeFile(sealed, bytes.subarray(0, 20));
    await assert.rejects(
      decryptFile(sealed, join(dir, "restored"), pair.privateKey),
    );
  }));
test("conserva destinos que ya existen", () =>
  temporary(async (dir) => {
    const source = join(dir, "source"),
      sealed = join(dir, "sealed"),
      restored = join(dir, "restored");
    await fs.writeFile(source, "sintético");
    await fs.writeFile(sealed, "existente");
    await assert.rejects(encryptFile(source, sealed, pair.publicKey));
    assert.equal(await fs.readFile(sealed, "utf8"), "existente");
    await fs.rm(sealed);
    await encryptFile(source, sealed, pair.publicKey);
    await fs.writeFile(restored, "conservar");
    await assert.rejects(decryptFile(sealed, restored, pair.privateKey));
    assert.equal(await fs.readFile(restored, "utf8"), "conservar");
  }));

test("la CA de Supabase coincide con el certificado público oficial", async () => {
  const { X509Certificate } = await import("node:crypto");
  const { SUPABASE_CA_PEM } = await import("./remote-backup.mjs");
  const ca = new X509Certificate(SUPABASE_CA_PEM);
  assert.equal(ca.ca, true);
  assert.equal(
    ca.fingerprint256.replaceAll(":", "").toLowerCase(),
    "807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa",
  );
});
