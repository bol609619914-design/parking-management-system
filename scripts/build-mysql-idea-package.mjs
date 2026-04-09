import { spawnSync } from "node:child_process";
import { cp, copyFile, mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release", "mysql-idea");
const templateDir = path.join(rootDir, "deploy", "mysql-idea");
const runtimeDir = path.join(releaseDir, "runtime", "nodejs");
const sourceNodeDir = path.dirname(process.execPath);
const zipPath = path.join(rootDir, "release", `parking-management-system-mysql-idea-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.zip`);

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
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}

async function removeIfExists(target) {
  await unlink(target).catch(() => {});
}

async function writePackageReadme() {
  const source = await readFile(path.join(templateDir, "README-MYSQL-IDEA.md"), "utf8");
  await writeFile(path.join(releaseDir, "README-MYSQL-IDEA.md"), `\uFEFF${source}`, "utf8");
}

async function copyProjectFiles() {
  const directories = ["dist", "docs", "prisma", "server", "src", "node_modules"];
  const files = [
    ".env.example",
    "package.json",
    "package-lock.json",
    "prisma.config.ts",
    "vite.config.js",
    "index.html",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
  ];

  for (const dir of directories) {
    await cp(path.join(rootDir, dir), path.join(releaseDir, dir), { recursive: true });
  }

  for (const file of files) {
    await copyFile(path.join(rootDir, file), path.join(releaseDir, file));
  }

  await removeIfExists(path.join(releaseDir, "server", "data", "parking.db"));
  await removeIfExists(path.join(releaseDir, "server", "data", "parking.db-shm"));
  await removeIfExists(path.join(releaseDir, "server", "data", "parking.db-wal"));
  await rm(path.join(releaseDir, "node_modules", ".cache"), { recursive: true, force: true });
  await rm(path.join(releaseDir, "node_modules", ".vite"), { recursive: true, force: true });
  await rm(path.join(releaseDir, "node_modules", ".vite-temp"), { recursive: true, force: true });
}

async function copyTemplates() {
  await copyFile(path.join(templateDir, ".env.mysql.example"), path.join(releaseDir, ".env.mysql.example"));
  await copyFile(path.join(templateDir, "mysql-init.sql"), path.join(releaseDir, "mysql-init.sql"));
  await copyFile(path.join(templateDir, "setup-mysql.bat"), path.join(releaseDir, "setup-mysql.bat"));
  await copyFile(path.join(templateDir, "setup-mysql.ps1"), path.join(releaseDir, "setup-mysql.ps1"));
  await copyFile(path.join(templateDir, "start-app.bat"), path.join(releaseDir, "start-app.bat"));
  await copyFile(path.join(templateDir, "start-app.ps1"), path.join(releaseDir, "start-app.ps1"));
  await copyFile(path.join(templateDir, "start-dev.bat"), path.join(releaseDir, "start-dev.bat"));
  await copyFile(path.join(templateDir, "start-dev.ps1"), path.join(releaseDir, "start-dev.ps1"));
  await copyFile(path.join(templateDir, "reset-mysql-demo-data.bat"), path.join(releaseDir, "reset-mysql-demo-data.bat"));
  await copyFile(path.join(templateDir, "reset-mysql-demo-data.ps1"), path.join(releaseDir, "reset-mysql-demo-data.ps1"));
  await writePackageReadme();
}

async function copyRuntime() {
  await mkdir(path.dirname(runtimeDir), { recursive: true });
  await cp(sourceNodeDir, runtimeDir, { recursive: true });
}

async function main() {
  console.log("1/4 Building frontend bundle...");
  run("npm", ["run", "build"]);

  console.log("2/4 Preparing MySQL package directory...");
  await ensureEmptyDir(releaseDir);

  console.log("3/4 Copying project files...");
  await copyProjectFiles();
  await copyTemplates();
  await copyRuntime();

  console.log("4/4 Creating zip archive...");
  await rm(zipPath, { force: true });
  run("tar", ["-a", "-cf", zipPath, "-C", path.join(rootDir, "release"), "mysql-idea"]);

  console.log(`MySQL IDEA package created at: ${releaseDir}`);
  console.log(`Zip archive created at: ${zipPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
