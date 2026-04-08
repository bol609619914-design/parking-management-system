process.env.APP_STORAGE = process.env.APP_STORAGE || "sqlite";
process.env.SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || "./server/data/parking.db";

const { ensureStorageReady, getStorageMeta, readDb } = await import("../server/lib/store.js");

await ensureStorageReady();

const storage = getStorageMeta();
const db = await readDb();

console.log(
  JSON.stringify(
    {
      ok: true,
      storage: storage.mode,
      storagePath: storage.path,
      users: db.users.length,
      spaces: db.spaces.length,
      alerts: db.alerts.length,
    },
    null,
    2,
  ),
);
