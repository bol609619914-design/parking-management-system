import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readDb, writeDb, nextId } from "./lib/store.js";
import { calculateBill, buildFinance, buildReports } from "./lib/billing.js";
import { recognizeVehicle } from "./lib/ocr.js";

const app = express();
const port = process.env.PORT || 5050;
const jwtSecret = process.env.JWT_SECRET || "parksphere-dev-secret";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "../dist");

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, jwtSecret, { expiresIn: "8h" });
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    return res.status(401).json({ message: "缺少登录令牌" });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    res.status(401).json({ message: "登录状态已失效，请重新登录" });
  }
}

function buildOverview(spaces) {
  return {
    total: spaces.length,
    available: spaces.filter((space) => space.status === "available").length,
    fixed: spaces.filter((space) => space.type === "fixed").length,
    temporary: spaces.filter((space) => space.type === "temporary").length,
  };
}

function buildUserPortal(db, user) {
  return {
    viewType: "user",
    alerts: db.alerts.slice(0, 2),
    userPortal: db.userPortals[user.sub] || null,
  };
}

function requireUserRole(req, res) {
  if (req.user?.role !== "user") {
    res.status(403).json({ message: "当前账号无权访问用户端操作" });
    return false;
  }
  return true;
}

function requireConsoleRole(req, res) {
  if (!["admin", "merchant"].includes(req.user?.role)) {
    res.status(403).json({ message: "当前账号无权访问后台操作" });
    return false;
  }
  return true;
}

function requireAdminRole(req, res) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ message: "仅管理端可修改计费规则" });
    return false;
  }
  return true;
}

function formatDurationLabel(durationMinutes) {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;
  if (!hours) return `${minutes} 分`;
  if (!minutes) return `${hours} 小时`;
  return `${hours} 小时 ${minutes} 分`;
}

function dashboardPayload(db, user) {
  if (user?.role === "user") {
    return buildUserPortal(db, user);
  }

  return {
    viewType: "console",
    overview: buildOverview(db.spaces),
    alerts: db.alerts,
    ocr: db.lastOcr,
    pricing: db.pricing,
    map: db.spaces,
    finance: buildFinance(db.entries, db.payments),
    reports: buildReports(db.payments),
    gates: db.gates,
  };
}

function findCoupon(db, code) {
  return db.coupons.find((item) => item.code === code) || null;
}

function occupySpace(db, plateType) {
  const preferredType = plateType === "fixed" ? "fixed" : plateType === "vip" ? "vip" : "temporary";
  const space = db.spaces.find((item) => item.status === "available" && item.type === preferredType) || db.spaces.find((item) => item.status === "available");
  if (!space) {
    return null;
  }
  space.status = preferredType === "vip" ? "reserved" : preferredType === "fixed" ? "monthly" : "occupied";
  return space;
}

function releaseSpace(db, code) {
  const space = db.spaces.find((item) => item.code === code);
  if (!space) {
    return;
  }
  space.status = space.type === "vip" ? "reserved" : space.type === "fixed" ? "monthly" : "available";
}

function updateSpaceState(space, action) {
  switch (action) {
    case "reserve":
      space.status = "reserved";
      if (space.type === "temporary") space.type = "vip";
      break;
    case "occupy":
      space.status = "occupied";
      break;
    case "release":
      space.status = space.type === "vip" ? "reserved" : space.type === "fixed" ? "monthly" : "available";
      break;
    case "monthly":
      space.type = "fixed";
      space.status = "monthly";
      break;
    case "temporary":
      space.type = "temporary";
      space.status = "available";
      break;
    default:
      throw new Error("\u4e0d\u652f\u6301\u7684\u8f66\u4f4d\u64cd\u4f5c");
  }
  return space;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

app.post("/api/auth/send-otp", (req, res) => {
  const db = readDb();
  const phone = req.body?.phone;
  if (!phone) {
    return res.status(400).json({ message: "请输入手机号" });
  }
  const code = db.otp[phone] || "246810";
  res.json({ phone, code, expiresIn: 300 });
});

app.post("/api/auth/reset-password", (req, res) => {
  const db = readDb();
  const { phone, otp, newPassword } = req.body || {};
  const user = db.users.find((item) => item.phone === phone);

  if (!phone || !otp || !newPassword) {
    return res.status(400).json({ message: "请完整填写手机号、验证码和新密码" });
  }

  if (!user) {
    return res.status(404).json({ message: "未找到对应账号" });
  }

  if (db.otp[phone] !== otp) {
    return res.status(401).json({ message: "短信验证码错误" });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "新密码至少需要 6 位" });
  }

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  writeDb(db);
  res.json({ ok: true, message: "密码已重置，请使用新密码登录" });
});

app.post("/api/auth/login", (req, res) => {
  const db = readDb();
  const { mode, identifier, password, phone, otp } = req.body || {};

  let user = null;
  if (mode === "password") {
    user = db.users.find((item) => item.email === identifier || item.phone === identifier);
    if (!user || !bcrypt.compareSync(password || "", user.passwordHash)) {
      return res.status(401).json({ message: "账号或密码错误" });
    }
  } else if (mode === "otp") {
    user = db.users.find((item) => item.phone === phone);
    if (!user || db.otp[phone] !== otp) {
      return res.status(401).json({ message: "短信验证码错误" });
    }
  } else {
    return res.status(400).json({ message: "不支持的登录方式" });
  }

  res.json({
    token: signToken(user),
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      phone: user.phone,
    },
  });
});

app.post("/api/auth/register", (req, res) => {
  const db = readDb();
  const { applicant, email, role, siteName, siteCode, agreement } = req.body || {};
  if (!agreement) {
    return res.status(400).json({ message: "请先勾选服务协议" });
  }

  const applicationId = nextId("apply");
  db.applications.push({
    id: applicationId,
    applicant,
    email,
    role,
    siteName,
    siteCode,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
  writeDb(db);
  res.json({ applicationId, status: "pending" });
});

app.get("/api/dashboard", authMiddleware, (req, res) => {
  const db = readDb();
  res.json(dashboardPayload(db, req.user));
});

app.post("/api/ocr/recognize", authMiddleware, (req, res) => {
  if (!requireConsoleRole(req, res)) return;

  const db = readDb();
  const result = recognizeVehicle(req.body || {}, db.vehicleProfiles);
  db.lastOcr = result;
  writeDb(db);
  res.json(result);
});

app.put("/api/spaces/:code", authMiddleware, (req, res) => {
  if (!requireConsoleRole(req, res)) return;

  const db = readDb();
  const space = db.spaces.find((item) => item.code === req.params.code);
  if (!space) {
    return res.status(404).json({ message: "\u672a\u627e\u5230\u5bf9\u5e94\u8f66\u4f4d" });
  }

  try {
    updateSpaceState(space, (req.body || {}).action);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }

  writeDb(db);
  res.json({
    space,
    map: db.spaces,
    overview: buildOverview(db.spaces),
  });
});

app.post("/api/user/reservations", authMiddleware, (req, res) => {
  if (!requireUserRole(req, res)) return;

  const db = readDb();
  const portal = db.userPortals[req.user.sub];
  const body = req.body || {};
  if (!portal) {
    return res.status(404).json({ message: "未找到用户端服务数据" });
  }

  const reservation = {
    id: nextId("reserve"),
    site: body.site || "星港商业中心 B1 层 08 号位",
    time: body.time || "今天 20:00 - 23:00",
    status: "已确认",
  };

  portal.reservations.unshift(reservation);
  portal.notices.unshift({
    id: nextId("notice"),
    title: "预约成功",
    message: `${reservation.site} 已为你锁定，请在预约时段内到场。`,
    time: "刚刚",
  });

  writeDb(db);
  res.json({ reservation, userPortal: portal });
});

app.post("/api/user/checkout", authMiddleware, (req, res) => {
  if (!requireUserRole(req, res)) return;

  const db = readDb();
  const portal = db.userPortals[req.user.sub];
  const body = req.body || {};
  if (!portal) {
    return res.status(404).json({ message: "未找到用户端服务数据" });
  }

  const activeParking = portal.activeParking;
  if (!activeParking || activeParking.billingStatus === "已完成支付，可离场" || activeParking.billingStatus === "当前无在场车辆") {
    return res.status(400).json({ message: "当前没有可结算的停车记录" });
  }

  const entry = db.entries.find(
    (item) =>
      item.status === "active" &&
      item.plateNumber === activeParking.plateNumber &&
      item.spaceCode === activeParking.spaceCode,
  );

  if (!entry) {
    return res.status(404).json({ message: "未找到当前在场车辆记录" });
  }

  const coupon = findCoupon(db, body.couponCode);
  const bill = calculateBill({ entry, pricing: db.pricing, coupon });

  entry.status = "closed";
  entry.exitTime = bill.exitTime;
  entry.gateOut = "gate-east-out";
  entry.billing = bill;
  releaseSpace(db, entry.spaceCode);

  const payment = {
    id: nextId("pay"),
    entryId: entry.id,
    plateNumber: entry.plateNumber,
    amount: bill.finalAmount,
    discountAmount: bill.discountAmount,
    channel: body.paymentChannel || "扫码支付",
    createdAt: bill.exitTime,
  };
  db.payments.push(payment);

  portal.orders.unshift({
    id: payment.id,
    plateNumber: entry.plateNumber,
    site: activeParking.lotName,
    duration: formatDurationLabel(bill.durationMinutes),
    amount: bill.finalAmount,
    channel: payment.channel,
  });
  portal.notices.unshift({
    id: nextId("notice"),
    title: "离场缴费完成",
    message: `${entry.plateNumber} 已完成支付，可直接离场。`,
    time: "刚刚",
  });
  portal.activeParking = {
    plateNumber: entry.plateNumber,
    lotName: activeParking.lotName,
    spaceCode: entry.spaceCode,
    entryLabel: "本次停车已完成结算",
    durationLabel: formatDurationLabel(bill.durationMinutes),
    currentAmount: 0,
    billingStatus: "已完成支付，可离场",
  };

  writeDb(db);
  res.json({ bill, payment, userPortal: portal });
});

app.post("/api/entries", authMiddleware, (req, res) => {
  if (!requireConsoleRole(req, res)) return;

  const db = readDb();
  const body = req.body || {};
  const ocr = recognizeVehicle({ gateId: body.gateId, imageHint: body.plateNumber }, db.vehicleProfiles);
  db.lastOcr = ocr;

  if (ocr.listType === "blacklist") {
    writeDb(db);
    return res.status(403).json({ message: ocr.gateActionMessage });
  }

  const existing = db.entries.find((entry) => entry.status === "active" && entry.plateNumber.replace(/\s+/g, "") === ocr.plateNumber.replace(/\s+/g, ""));
  if (existing) {
    writeDb(db);
    return res.status(409).json({ message: "该车辆已在场内，无需重复入场" });
  }

  const space = occupySpace(db, body.plateType || ocr.vehicleType);
  if (!space) {
    return res.status(400).json({ message: "当前停车场已无可用车位" });
  }

  const entry = {
    id: nextId("entry"),
    plateNumber: ocr.plateNumber,
    plateType: body.plateType || ocr.vehicleType,
    entryTime: new Date().toISOString(),
    gateIn: body.gateId,
    spaceCode: space.code,
    status: "active",
  };

  db.entries.push(entry);
  writeDb(db);
  res.json({ entry, ocr, message: ocr.gateActionMessage, overview: buildOverview(db.spaces) });
});

app.post("/api/exits", authMiddleware, (req, res) => {
  if (!requireConsoleRole(req, res)) return;

  const db = readDb();
  const body = req.body || {};
  const entry = db.entries.find((item) => item.status === "active" && (item.id === body.entryId || item.plateNumber === body.plateNumber));
  if (!entry) {
    return res.status(404).json({ message: "未找到有效的在场车辆记录" });
  }

  const coupon = findCoupon(db, body.couponCode);
  const bill = calculateBill({ entry, pricing: db.pricing, coupon });

  entry.status = "closed";
  entry.exitTime = bill.exitTime;
  entry.gateOut = "gate-east-out";
  entry.billing = bill;
  releaseSpace(db, entry.spaceCode);

  const payment = {
    id: nextId("pay"),
    entryId: entry.id,
    plateNumber: entry.plateNumber,
    amount: bill.finalAmount,
    discountAmount: bill.discountAmount,
    channel: body.paymentChannel || "扫码支付",
    createdAt: bill.exitTime,
  };

  db.payments.push(payment);
  writeDb(db);
  res.json({ bill, payment, overview: buildOverview(db.spaces) });
});

app.put("/api/billing/config", authMiddleware, (req, res) => {
  if (!requireAdminRole(req, res)) return;

  const db = readDb();
  const body = req.body || {};
  db.pricing = {
    ...db.pricing,
    freeMinutes: Number(body.freeMinutes),
    hourlyRate: Number(body.hourlyRate),
    stepMinutes: Number(body.stepMinutes || 30),
    stepRate: Number(body.stepRate),
    capAmount: Number(body.capAmount),
    nightRate: Number(body.nightRate || db.pricing.nightRate),
  };
  writeDb(db);
  res.json(db.pricing);
});

app.use(express.static(distPath));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`ParkSphere API running at http://localhost:${port}`);
});
