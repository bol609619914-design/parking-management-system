import path from "node:path";
import { fileURLToPath } from "node:url";
import { readJsonDb, readSeedDb, writeJsonDb } from "./jsonStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultSqlitePath = path.join(__dirname, "../data/parking.db");

let sqliteModulePromise;
let prismaStoreModulePromise;
let prismaClientModulePromise;

function resolveSqlitePath() {
  const configuredPath = process.env.SQLITE_DB_PATH || defaultSqlitePath;
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
}

function getSqliteModule() {
  sqliteModulePromise ||= import("./sqliteStore.js");
  return sqliteModulePromise;
}

function getPrismaStoreModule() {
  prismaStoreModulePromise ||= import("./prismaStore.js");
  return prismaStoreModulePromise;
}

function getPrismaClientModule() {
  prismaClientModulePromise ||= import("./prisma.js");
  return prismaClientModulePromise;
}

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
    ...(mode === "sqlite" ? { path: resolveSqlitePath() } : {}),
  };
}

export async function ensureStorageReady() {
  switch (getStorageMode()) {
    case "mysql": {
      const { ensurePrismaReady } = await getPrismaClientModule();
      await ensurePrismaReady();
      return;
    }
    case "sqlite": {
      const { ensureSqliteReady } = await getSqliteModule();
      await ensureSqliteReady(readSeedDb());
      return;
    }
    default:
      return;
  }
}

export async function readDb() {
  switch (getStorageMode()) {
    case "mysql": {
      const { readDbFromPrisma } = await getPrismaStoreModule();
      return readDbFromPrisma();
    }
    case "sqlite": {
      const { readDbFromSqlite } = await getSqliteModule();
      return readDbFromSqlite();
    }
    default:
      return readJsonDb();
  }
}

export async function writeDb(data) {
  switch (getStorageMode()) {
    case "mysql": {
      const { writeDbToPrisma } = await getPrismaStoreModule();
      await writeDbToPrisma(data);
      return;
    }
    case "sqlite": {
      const { writeDbToSqlite } = await getSqliteModule();
      await writeDbToSqlite(data);
      return;
    }
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
