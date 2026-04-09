import "dotenv/config";
import { loadSeedDb } from "../server/lib/store.js";
import { writeDbToPrisma } from "../server/lib/prismaStore.js";
import { disconnectPrisma } from "../server/lib/prisma.js";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("缺少 DATABASE_URL，无法向 MySQL 写入种子数据");
  }

  const seed = loadSeedDb();
  await writeDbToPrisma(seed);
  console.log("MySQL 种子数据写入完成");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
