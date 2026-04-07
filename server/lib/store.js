import { readJsonDb, readSeedDb, writeJsonDb } from "./jsonStore.js";
import { readDbFromPrisma, writeDbToPrisma } from "./prismaStore.js";

export function isDatabaseEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

export async function readDb() {
  if (!isDatabaseEnabled()) {
    return readJsonDb();
  }

  return readDbFromPrisma();
}

export async function writeDb(data) {
  if (!isDatabaseEnabled()) {
    writeJsonDb(data);
    return;
  }

  await writeDbToPrisma(data);
}

export function loadSeedDb() {
  return readSeedDb();
}

export function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
