import process from "node:process";
import console from "node:console";
import fs from "node:fs/promises";
import { initializeKey, IMAGE } from "./scripts/remote-backup.mjs";
import { join } from "node:path";
const key = await initializeKey(
  join(process.env.LOCALAPPDATA, "FinTin", "Backups", "keys"),
);
const source = (await fs.readFile("scripts/remote-backup.mjs", "utf8")).trim();
const template = await fs.readFile(
  ".github/workflows/remote-backup.template.yml",
  "utf8",
);
const workflow = template
  .replace("#IMAGE#", IMAGE)
  .replace("#PUBLICKEY#", key.publicKeyBase64)
  .replace("#FINGERPRINT#", key.fingerprint)
  .replace(
    "#SCRIPT#",
    source
      .split("\n")
      .map((line) => "          " + line)
      .join("\n"),
  );
await fs.writeFile(".github/workflows/fintin-remote-backup.yml", workflow);
console.log(
  "Workflow preparado. Huella de la clave pública: " + key.fingerprint,
);
