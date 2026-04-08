import { readJsonDb, readSeedDb, writeJsonDb } from "./jsonStore.js";
import { readDbFromPrisma, writeDbToPrisma } from "./prismaStore.js";
import { ensureSqliteReady, getSqliteDbPath, readDbFromSqlite, writeDbToSqlite } from "./sqliteStore.js";

export function getStorageMode() {
  const explicitMode = (process.env.APP_STORAGE || "").trim().toLowerCase();
  if (explicitMode === "json" || explicitMode === "sqlite" || explicitMode === "mysql") {
    return explicitMode;
  }

  if (process.env.DATABASE_URL) {
    return "mysql";
  }

  if (process.env.SQLITE_DB_PATH) {
    return "sqlite";
  }

  return "json";
}

export function isDatabaseEnabled() {
  return getStorageMode() !== "json";
}

export function getStorageMeta() {
  const mode = getStorageMode();
  return {
    mode,
    ...(mode === "sqlite" ? { path: getSqliteDbPath() } : {}),
  };
}

export async function ensureStorageReady() {
  if (getStorageMode() === "sqlite") {
    await ensureSqliteReady(readSeedDb());
  }
}

export async function readDb() {
  switch (getStorageMode()) {
    case "mysql":
      return readDbFromPrisma();
    case "sqlite":
      return readDbFromSqlite();
    default:
      return readJsonDb();
  }
}

export async function writeDb(data) {
  switch (getStorageMode()) {
    case "mysql":
      await writeDbToPrisma(data);
      return;
    case "sqlite":
      await writeDbToSqlite(data);
      return;
    default:
      writeJsonDb(data);
  }
}

export function loadSeedDb() {
  return readSeedDb();
}

export function nextId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
