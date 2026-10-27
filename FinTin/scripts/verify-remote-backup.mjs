import fs from "node:fs/promises";
import process from "node:process";
import console from "node:console";

import { join, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { decryptFile, fingerprint, sha256, PROJECT } from "./remote-backup.mjs";
function run(program, args) {
  return new Promise((yes, no) => {
    const p = spawn(program, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "",
      err = "";
    p.stdout.on("data", (x) => {
      out += x;
      if (out.length > 2e6) p.kill();
    });
    p.stderr.on("data", (x) => {
      err += x;
      if (err.length > 2e6) p.kill();
    });
    p.once("error", no);
    p.once("close", (code) =>
      code === 0
        ? yes(out)
        : no(new Error(err || "Falló la verificación local")),
    );
  });
}
async function verify() {
  const [encrypted, runId, expectedHash] = process.argv.slice(2);
  if (
    !encrypted ||
    !/^\d+$/.test(runId || "") ||
    !/^[a-f0-9]{64}$/i.test(expectedHash || "")
  )
    throw new Error(
      "Uso: verify-remote-backup.mjs archivo.enc runId sha256-cifrado",
    );
  if ((await sha256(encrypted)) !== expectedHash.toLowerCase())
    throw new Error(
      "El archivo cifrado no coincide con el hash de la ejecución",
    );
  const base = join(process.env.LOCALAPPDATA, "FinTin", "Backups");
  const privateKey = await fs.readFile(
    join(base, "keys", "backup-private.pem"),
    "utf8",
  );
  const directory = join(
    base,
    "remoto",
    runId + "-" + new Date().toISOString().replace(/[:.]/g, "-"),
  );
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  if (!resolve(directory).startsWith(resolve(base) + sep))
    throw new Error("Destino local incorrecto");
  const archive = join(directory, "backup.tar");
  await decryptFile(encrypted, archive, privateKey);
  const names = (await run("tar", ["-tf", archive])).trim().split(/\r?\n/);
  const expected = [
    "database.dump",
    "roles-sin-passwords.sql",
    "manifest.json",
  ];
  if (
    names.length !== expected.length ||
    names.some((n, i) => n !== expected[i])
  )
    throw new Error("El archivo contiene entradas inesperadas; no se extrae");
  await run("tar", ["-xf", archive, "-C", directory]);
  for (const name of expected) {
    if (!(await fs.lstat(join(directory, name))).isFile())
      throw new Error("Entrada de respaldo no regular");
  }
  const manifest = JSON.parse(
    await fs.readFile(join(directory, "manifest.json"), "utf8"),
  );
  if (
    manifest.project !== PROJECT ||
    manifest.runId !== runId ||
    manifest.keyFingerprint !== fingerprint(privateKey) ||
    manifest.identity?.database !== "postgres" ||
    !manifest.identity.tracktin ||
    manifest.identity.fintin_objects !== 0
  )
    throw new Error(
      "El manifiesto no coincide con la ejecución y el proyecto esperados",
    );
  if (!Array.isArray(manifest.files) || manifest.files.length !== 2)
    throw new Error("Lista de archivos incorrecta");
  for (const name of expected.slice(0, 2)) {
    const record = manifest.files.find((f) => f.file === name);
    const path = join(directory, name);
    if (
      !record ||
      record.bytes !== (await fs.stat(path)).size ||
      record.sha256 !== (await sha256(path))
    )
      throw new Error("Hash o tamaño incorrecto para " + name);
  }
  const tool = join(
    process.env.TEMP,
    "FinTin-postgresql-17-tools",
    "pg_restore.exe",
  );
  const toc = await run(tool, ["--list", join(directory, "database.dump")]);
  if (!toc.includes("tracktin_media"))
    throw new Error("TrackTin no figura en el índice local");
  await run(tool, ["--file=NUL", join(directory, "database.dump")]);
  const report = {
    verified: true,
    project: PROJECT,
    runId,
    encryptedSha256: expectedHash.toLowerCase(),
    directory,
    keyFingerprint: manifest.keyFingerprint,
    verifiedAt: new Date().toISOString(),
    verification:
      "Descifrado autenticado, SHA-256 de archivos y lectura completa de pg_restore; no restaura en producción",
  };
  await fs.writeFile(
    join(directory, "local-verification.json"),
    JSON.stringify(report, null, 2),
    { mode: 0o600, flag: "wx" },
  );
  await fs.writeFile(
    join(base, "last-verified-remote.json"),
    JSON.stringify(report, null, 2),
    { mode: 0o600 },
  );
  console.log(JSON.stringify(report));
}
verify().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
