import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultDbPath = path.join(__dirname, "../data/parking.db");
const globalForSqlite = globalThis;

const defaultPricing = {
  freeMinutes: 30,
  hourlyRate: 8,
  stepMinutes: 30,
  stepRate: 4,
  capAmount: 88,
  nightRate: 5,
};

function resolveSqlitePath() {
  const configuredPath = process.env.SQLITE_DB_PATH || defaultDbPath;
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
}

function ensureSchema(db) {
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      applicant TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      site_name TEXT NOT NULL,
      site_code TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pricing_configs (
      id INTEGER PRIMARY KEY,
      free_minutes INTEGER NOT NULL,
      hourly_rate INTEGER NOT NULL,
      step_minutes INTEGER NOT NULL,
      step_rate INTEGER NOT NULL,
      cap_amount INTEGER NOT NULL,
      night_rate INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gates (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      level TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS spaces (
      code TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      type TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicle_profiles (
      plate_number TEXT PRIMARY KEY,
      list_type TEXT NOT NULL,
      owner TEXT NOT NULL,
      vehicle_type TEXT NOT NULL,
      reason TEXT
    );

    CREATE TABLE IF NOT EXISTS coupons (
      code TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      plate_number TEXT NOT NULL,
      plate_type TEXT NOT NULL,
      entry_time TEXT NOT NULL,
      exit_time TEXT,
      gate_in TEXT NOT NULL,
      gate_out TEXT,
      space_code TEXT NOT NULL,
      status TEXT NOT NULL,
      billing TEXT
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      sort_order INTEGER NOT NULL DEFAULT 0,
      entry_id TEXT NOT NULL,
      plate_number TEXT NOT NULL,
      amount REAL NOT NULL,
      discount_amount REAL NOT NULL,
      channel TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS otp_codes (
      phone TEXT PRIMARY KEY,
      code TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ocr_snapshots (
      id INTEGER PRIMARY KEY,
      gate_id TEXT,
      plate_number TEXT,
      normalized_plate TEXT,
      confidence INTEGER,
      provider TEXT,
      list_type TEXT,
      vehicle_type TEXT,
      gate_action_message TEXT
    );

    CREATE TABLE IF NOT EXISTS user_portals (
      user_id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      active_parking TEXT NOT NULL,
      reservations TEXT NOT NULL,
      coupons TEXT NOT NULL,
      orders TEXT NOT NULL,
      membership TEXT NOT NULL,
      notices TEXT NOT NULL
    );
  `);
}

function getSqliteDb() {
  const dbPath = resolveSqlitePath();

  if (!globalForSqlite.__parksphereSqlite || globalForSqlite.__parksphereSqlitePath !== dbPath) {
    if (globalForSqlite.__parksphereSqlite) {
      globalForSqlite.__parksphereSqlite.close();
    }

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new DatabaseSync(dbPath);
    ensureSchema(db);

    globalForSqlite.__parksphereSqlite = db;
    globalForSqlite.__parksphereSqlitePath = dbPath;
  }

  return globalForSqlite.__parksphereSqlite;
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringifyJson(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function buildVehicleProfileMap(rows) {
  return Object.fromEntries(
    rows.map((row) => [
      row.plateNumber,
      {
        listType: row.listType,
        owner: row.owner,
        vehicleType: row.vehicleType,
        ...(row.reason ? { reason: row.reason } : {}),
      },
    ]),
  );
}

function buildOtpMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.phone, row.code]));
}

function buildUserPortalMap(rows) {
  return Object.fromEntries(
    rows.map((row) => [
      row.userId,
      {
        summary: parseJson(row.summary, []),
        activeParking: parseJson(row.activeParking, {}),
        reservations: parseJson(row.reservations, []),
        coupons: parseJson(row.coupons, []),
        orders: parseJson(row.orders, []),
        membership: parseJson(row.membership, {}),
        notices: parseJson(row.notices, []),
      },
    ]),
  );
}

export function getSqliteDbPath() {
  return resolveSqlitePath();
}

export async function ensureSqliteReady(seedData) {
  const db = getSqliteDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  if (row.count === 0 && seedData) {
    await writeDbToSqlite(seedData);
  }
}

export async function readDbFromSqlite() {
  const db = getSqliteDb();
  const users = db
    .prepare("SELECT id, sort_order AS sortOrder, name, role, email, phone, password_hash AS passwordHash FROM users ORDER BY sort_order ASC")
    .all();
  const applications = db
    .prepare(
      "SELECT id, sort_order AS sortOrder, applicant, email, role, site_name AS siteName, site_code AS siteCode, status, created_at AS createdAt FROM applications ORDER BY sort_order ASC",
    )
    .all();
  const pricing = db
    .prepare(
      "SELECT free_minutes AS freeMinutes, hourly_rate AS hourlyRate, step_minutes AS stepMinutes, step_rate AS stepRate, cap_amount AS capAmount, night_rate AS nightRate FROM pricing_configs WHERE id = 1",
    )
    .get();
  const gates = db.prepare("SELECT id, name, status FROM gates ORDER BY sort_order ASC").all();
  const alerts = db.prepare("SELECT id, title, message, level FROM alerts ORDER BY sort_order ASC").all();
  const spaces = db.prepare("SELECT code, status, type FROM spaces ORDER BY sort_order ASC").all();
  const vehicleProfiles = db
    .prepare("SELECT plate_number AS plateNumber, list_type AS listType, owner, vehicle_type AS vehicleType, reason FROM vehicle_profiles ORDER BY plate_number ASC")
    .all();
  const coupons = db.prepare("SELECT code, type, value, name FROM coupons ORDER BY sort_order ASC").all();
  const entries = db
    .prepare(
      "SELECT id, plate_number AS plateNumber, plate_type AS plateType, entry_time AS entryTime, exit_time AS exitTime, gate_in AS gateIn, gate_out AS gateOut, space_code AS spaceCode, status, billing FROM entries ORDER BY sort_order ASC",
    )
    .all();
  const payments = db
    .prepare(
      "SELECT id, entry_id AS entryId, plate_number AS plateNumber, amount, discount_amount AS discountAmount, channel, created_at AS createdAt FROM payments ORDER BY sort_order ASC",
    )
    .all();
  const otpCodes = db.prepare("SELECT phone, code FROM otp_codes ORDER BY phone ASC").all();
  const ocrSnapshot = db
    .prepare(
      "SELECT gate_id AS gateId, plate_number AS plateNumber, normalized_plate AS normalizedPlate, confidence, provider, list_type AS listType, vehicle_type AS vehicleType, gate_action_message AS gateActionMessage FROM ocr_snapshots WHERE id = 1",
    )
    .get();
  const userPortals = db
    .prepare(
      "SELECT user_id AS userId, summary, active_parking AS activeParking, reservations, coupons, orders, membership, notices FROM user_portals ORDER BY user_id ASC",
    )
    .all();

  return {
    users: users.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      email: row.email,
      phone: row.phone,
      passwordHash: row.passwordHash,
    })),
    applications: applications.map((row) => ({
      id: row.id,
      applicant: row.applicant,
      email: row.email,
      role: row.role,
      siteName: row.siteName,
      siteCode: row.siteCode,
      status: row.status,
      createdAt: row.createdAt,
    })),
    pricing: pricing
      ? {
          freeMinutes: pricing.freeMinutes,
          hourlyRate: pricing.hourlyRate,
          stepMinutes: pricing.stepMinutes,
          stepRate: pricing.stepRate,
          capAmount: pricing.capAmount,
          nightRate: pricing.nightRate,
        }
      : { ...defaultPricing },
    gates,
    alerts,
    spaces,
    vehicleProfiles: buildVehicleProfileMap(vehicleProfiles),
    coupons,
    entries: entries.map((row) => ({
      id: row.id,
      plateNumber: row.plateNumber,
      plateType: row.plateType,
      entryTime: row.entryTime,
      gateIn: row.gateIn,
      spaceCode: row.spaceCode,
      status: row.status,
      ...(row.exitTime ? { exitTime: row.exitTime } : {}),
      ...(row.gateOut ? { gateOut: row.gateOut } : {}),
      ...(row.billing ? { billing: parseJson(row.billing, null) } : {}),
    })),
    payments: payments.map((row) => ({
      id: row.id,
      entryId: row.entryId,
      plateNumber: row.plateNumber,
      amount: row.amount,
      discountAmount: row.discountAmount,
      channel: row.channel,
      createdAt: row.createdAt,
    })),
    otp: buildOtpMap(otpCodes),
    lastOcr: ocrSnapshot
      ? {
          gateId: ocrSnapshot.gateId,
          plateNumber: ocrSnapshot.plateNumber,
          normalizedPlate: ocrSnapshot.normalizedPlate,
          confidence: ocrSnapshot.confidence,
          provider: ocrSnapshot.provider,
          listType: ocrSnapshot.listType,
          vehicleType: ocrSnapshot.vehicleType,
          gateActionMessage: ocrSnapshot.gateActionMessage,
        }
      : null,
    userPortals: buildUserPortalMap(userPortals),
  };
}

export async function writeDbToSqlite(data) {
  const db = getSqliteDb();

  const insertUser = db.prepare(
    "INSERT INTO users (id, sort_order, name, role, email, phone, password_hash) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertApplication = db.prepare(
    "INSERT INTO applications (id, sort_order, applicant, email, role, site_name, site_code, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPricing = db.prepare(
    "INSERT INTO pricing_configs (id, free_minutes, hourly_rate, step_minutes, step_rate, cap_amount, night_rate) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertGate = db.prepare("INSERT INTO gates (id, sort_order, name, status) VALUES (?, ?, ?, ?)");
  const insertAlert = db.prepare("INSERT INTO alerts (id, sort_order, title, message, level) VALUES (?, ?, ?, ?, ?)");
  const insertSpace = db.prepare("INSERT INTO spaces (code, sort_order, status, type) VALUES (?, ?, ?, ?)");
  const insertVehicleProfile = db.prepare(
    "INSERT INTO vehicle_profiles (plate_number, list_type, owner, vehicle_type, reason) VALUES (?, ?, ?, ?, ?)",
  );
  const insertCoupon = db.prepare("INSERT INTO coupons (code, sort_order, type, value, name) VALUES (?, ?, ?, ?, ?)");
  const insertEntry = db.prepare(
    "INSERT INTO entries (id, sort_order, plate_number, plate_type, entry_time, exit_time, gate_in, gate_out, space_code, status, billing) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertPayment = db.prepare(
    "INSERT INTO payments (id, sort_order, entry_id, plate_number, amount, discount_amount, channel, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertOtp = db.prepare("INSERT INTO otp_codes (phone, code) VALUES (?, ?)");
  const insertOcr = db.prepare(
    "INSERT INTO ocr_snapshots (id, gate_id, plate_number, normalized_plate, confidence, provider, list_type, vehicle_type, gate_action_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insertUserPortal = db.prepare(
    "INSERT INTO user_portals (user_id, summary, active_parking, reservations, coupons, orders, membership, notices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );

  try {
    db.exec("BEGIN IMMEDIATE");

    db.exec(`
      DELETE FROM user_portals;
      DELETE FROM payments;
      DELETE FROM entries;
      DELETE FROM applications;
      DELETE FROM otp_codes;
      DELETE FROM alerts;
      DELETE FROM gates;
      DELETE FROM spaces;
      DELETE FROM vehicle_profiles;
      DELETE FROM coupons;
      DELETE FROM ocr_snapshots;
      DELETE FROM pricing_configs;
      DELETE FROM users;
    `);

    (data.users || []).forEach((row, index) => {
      insertUser.run(row.id, index, row.name, row.role, row.email, row.phone, row.passwordHash);
    });

    (data.applications || []).forEach((row, index) => {
      insertApplication.run(row.id, index, row.applicant, row.email, row.role, row.siteName, row.siteCode, row.status, row.createdAt);
    });

    if (data.pricing) {
      insertPricing.run(
        1,
        Number(data.pricing.freeMinutes),
        Number(data.pricing.hourlyRate),
        Number(data.pricing.stepMinutes),
        Number(data.pricing.stepRate),
        Number(data.pricing.capAmount),
        Number(data.pricing.nightRate),
      );
    }

    (data.gates || []).forEach((row, index) => {
      insertGate.run(row.id, index, row.name, row.status);
    });

    (data.alerts || []).forEach((row, index) => {
      insertAlert.run(row.id, index, row.title, row.message, row.level);
    });

    (data.spaces || []).forEach((row, index) => {
      insertSpace.run(row.code, index, row.status, row.type);
    });

    Object.entries(data.vehicleProfiles || {}).forEach(([plateNumber, row]) => {
      insertVehicleProfile.run(plateNumber, row.listType, row.owner, row.vehicleType, row.reason || null);
    });

    (data.coupons || []).forEach((row, index) => {
      insertCoupon.run(row.code, index, row.type, Number(row.value), row.name);
    });

    (data.entries || []).forEach((row, index) => {
      insertEntry.run(
        row.id,
        index,
        row.plateNumber,
        row.plateType,
        row.entryTime,
        row.exitTime || null,
        row.gateIn,
        row.gateOut || null,
        row.spaceCode,
        row.status,
        row.billing ? stringifyJson(row.billing, null) : null,
      );
    });

    (data.payments || []).forEach((row, index) => {
      insertPayment.run(
        row.id,
        index,
        row.entryId,
        row.plateNumber,
        Number(row.amount),
        Number(row.discountAmount),
        row.channel,
        row.createdAt,
      );
    });

    Object.entries(data.otp || {}).forEach(([phone, code]) => {
      insertOtp.run(phone, code);
    });

    if (data.lastOcr) {
      insertOcr.run(
        1,
        data.lastOcr.gateId || null,
        data.lastOcr.plateNumber || null,
        data.lastOcr.normalizedPlate || null,
        data.lastOcr.confidence || null,
        data.lastOcr.provider || null,
        data.lastOcr.listType || null,
        data.lastOcr.vehicleType || null,
        data.lastOcr.gateActionMessage || null,
      );
    }

    Object.entries(data.userPortals || {}).forEach(([userId, portal]) => {
      insertUserPortal.run(
        userId,
        stringifyJson(portal.summary, []),
        stringifyJson(portal.activeParking, {}),
        stringifyJson(portal.reservations, []),
        stringifyJson(portal.coupons, []),
        stringifyJson(portal.orders, []),
        stringifyJson(portal.membership, {}),
        stringifyJson(portal.notices, []),
      );
    });

    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
    }
    throw error;
  }
}

export async function disconnectSqlite() {
  if (globalForSqlite.__parksphereSqlite) {
    globalForSqlite.__parksphereSqlite.close();
    globalForSqlite.__parksphereSqlite = undefined;
    globalForSqlite.__parksphereSqlitePath = undefined;
  }
}
