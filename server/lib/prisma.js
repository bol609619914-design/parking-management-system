import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

function buildAdapterConfig() {
  if (!process.env.DATABASE_URL) {
    throw new Error("缺少 DATABASE_URL，无法初始化 Prisma MySQL 连接");
  }

  const url = new URL(process.env.DATABASE_URL);
  const allowPublicKeyRetrieval = url.searchParams.get("allowPublicKeyRetrieval");
  const ssl = url.searchParams.get("ssl");

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || undefined,
    allowPublicKeyRetrieval: allowPublicKeyRetrieval ? allowPublicKeyRetrieval === "true" : true,
    ssl: ssl ? ssl !== "false" : false,
    ...(url.searchParams.get("connection_limit")
      ? { connectionLimit: Number(url.searchParams.get("connection_limit")) }
      : {}),
  };
}

export function getPrismaClient() {
  if (!globalForPrisma.__parkspherePrisma) {
    const adapter = new PrismaMariaDb(buildAdapterConfig());
    globalForPrisma.__parkspherePrisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["warn"] : [],
    });
  }

  return globalForPrisma.__parkspherePrisma;
}

export async function ensurePrismaReady() {
  const config = buildAdapterConfig();
  const prisma = getPrismaClient();
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new Error(`无法连接 MySQL 数据库：${config.host}:${config.port}/${config.database}`);
  }
}

export async function disconnectPrisma() {
  if (globalForPrisma.__parkspherePrisma) {
    await globalForPrisma.__parkspherePrisma.$disconnect();
    globalForPrisma.__parkspherePrisma = undefined;
  }
}
