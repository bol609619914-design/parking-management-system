import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureStorageReady, getStorageMeta, readDb, writeDb, nextId } from "./lib/store.js";
import { jsonErrorHandler, notFound } from "./lib/http.js";
import { createAppServices } from "./lib/appServices.js";
import { registerAuthRoutes } from "./routes/authRoutes.js";
import { registerConsoleRoutes } from "./routes/consoleRoutes.js";
import { registerUserRoutes } from "./routes/userRoutes.js";

const app = express();
const port = process.env.PORT || 5050;
const jwtSecret = process.env.JWT_SECRET || "parksphere-dev-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "../dist");

const services = createAppServices({ jwtSecret });
const routeContext = {
  getStorageMeta,
  readDb,
  writeDb,
  nextId,
  services,
};

app.use(cors());
app.use(express.json({ limit: "2mb" }));

registerAuthRoutes(app, routeContext);
registerConsoleRoutes(app, routeContext);
registerUserRoutes(app, routeContext);

app.use("/api", (_req, _res, next) => {
  next(notFound("未找到对应 API 接口"));
});

app.use(jsonErrorHandler);
app.use(express.static(distPath));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

try {
  await ensureStorageReady();
  app.listen(port, () => {
    console.log(`ParkSphere API running at http://localhost:${port}`);
  });
} catch (error) {
  console.error("ParkSphere API startup failed:", error.message);
  process.exit(1);
}
