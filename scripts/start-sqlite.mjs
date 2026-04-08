process.env.APP_STORAGE = process.env.APP_STORAGE || "sqlite";
process.env.SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || "./server/data/parking.db";

await import("../server/index.js");
