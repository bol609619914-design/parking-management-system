import { spawnSync } from "node:child_process";
import { cp, copyFile, mkdir, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release", "portable");
const appDir = path.join(releaseDir, "app");
const runtimeDir = path.join(releaseDir, "runtime", "nodejs");
const templateDir = path.join(rootDir, "deploy", "portable");
const sourceNodeDir = path.dirname(process.execPath);

function run(command, args) {
  const result =
    process.platform === "win32"
      ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command, ...args], {
          cwd: rootDir,
          stdio: "inherit",
        })
      : spawnSync(command, args, {
          cwd: rootDir,
          stdio: "inherit",
        });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}

async function ensureEmptyDir(target) {
  const pidFile = path.join(target, ".runtime", "server.pid");
  try {
    const pidValue = (await readFile(pidFile, "utf8")).trim();
    if (pidValue) {
      try {
        process.kill(Number(pidValue));
      } catch {
      }
    }
  } catch {
  }

  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}

async function removeIfExists(target) {
  await unlink(target).catch(() => {});
}

async function writePortablePackageJson() {
  const sourcePackage = JSON.parse(await readFile(path.join(rootDir, "package.json"), "utf8"));
  const portablePackage = {
    name: `${sourcePackage.name}-portable`,
    version: sourcePackage.version,
    private: true,
    type: sourcePackage.type,
    main: "server/index.js",
  };

  await writeFile(path.join(appDir, "package.json"), `${JSON.stringify(portablePackage, null, 2)}\n`, "utf8");
}

async function writePortableEnv() {
  const envText = [
    'APP_STORAGE="sqlite"',
    'SQLITE_DB_PATH="./server/data/parking.db"',
    'JWT_SECRET="parksphere-portable-secret"',
    'PORT="5050"',
    "",
  ].join("\n");

  await writeFile(path.join(appDir, ".env"), envText, "utf8");
}

async function copyApplication() {
  await cp(path.join(rootDir, "dist"), path.join(appDir, "dist"), { recursive: true });
  await cp(path.join(rootDir, "server"), path.join(appDir, "server"), { recursive: true });
  await cp(path.join(rootDir, "scripts"), path.join(appDir, "scripts"), { recursive: true });
  await cp(path.join(rootDir, "node_modules"), path.join(appDir, "node_modules"), { recursive: true });

  await removeIfExists(path.join(appDir, "server", "data", "parking.db"));
  await removeIfExists(path.join(appDir, "server", "data", "parking.db-shm"));
  await removeIfExists(path.join(appDir, "server", "data", "parking.db-wal"));

  await copyFile(
    path.join(rootDir, "server", "data", "db.json"),
    path.join(appDir, "server", "data", "db.seed.json"),
  );

  await writePortablePackageJson();
  await writePortableEnv();
}

async function copyRuntime() {
  await cp(sourceNodeDir, runtimeDir, { recursive: true });
}

async function copyLaunchers() {
  const entries = await readdir(templateDir, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(templateDir, entry.name);
    const target = path.join(releaseDir, entry.name);
    if (entry.isDirectory()) {
      await cp(source, target, { recursive: true, force: true });
    } else {
      await copyFile(source, target);
    }
  }

  await copyFile(path.join(rootDir, "LICENSE"), path.join(releaseDir, "LICENSE"));
}

async function main() {
  console.log("1/4 Building frontend bundle...");
  run("npm", ["run", "build"]);

  console.log("2/4 Preparing portable directory...");
  await ensureEmptyDir(releaseDir);
  await mkdir(appDir, { recursive: true });

  console.log("3/4 Copying app files and embedded runtime...");
  await copyApplication();
  await copyRuntime();

  console.log("4/4 Writing launchers and docs...");
  await copyLaunchers();

  console.log(`Portable bundle created at: ${releaseDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
