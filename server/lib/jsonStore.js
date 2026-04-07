import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "../data/db.json");

export function readJsonDb() {
  const raw = fs.readFileSync(dbPath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

export function writeJsonDb(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), "utf8");
}

export function readSeedDb() {
  return readJsonDb();
}
