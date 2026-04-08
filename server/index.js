import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureStorageReady, getStorageMeta, readDb, writeDb, nextId } from "./lib/store.js";
import { calculateBill, buildFinance, buildReports } from "./lib/billing.js";
import { recognizeVehicle } from "./lib/ocr.js";
import { badRequest, conflict, forbidden, jsonErrorHandler, notFound, unauthorized, assert, asTrimmedText } from "./lib/http.js";
import { createPortalNotice, normalizeUserPortal } from "./lib/userPortal.js";

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
    return next(unauthorized("缺少登录令牌"));
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    next(unauthorized("登录状态已失效，请重新登录"));
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
  const portal = normalizeUserPortal(db.userPortals[user.sub] || null);
  return {
    viewType: "user",
    alerts: db.alerts.slice(0, 2),
    userPortal: portal,
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

function prependNotice(portal, notice) {
  portal.notices = [notice, ...(portal.notices || [])].slice(0, 12);
}

function ensurePortal(db, userId) {
  const portal = db.userPortals[userId];
  assert(portal, notFound("未找到用户端服务数据"));
  const normalized = normalizeUserPortal(portal);
  db.userPortals[userId] = normalized;
  return normalized;
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
  const storage = getStorageMeta();
  res.json({
    ok: true,
    now: new Date().toISOString(),
    storage: storage.mode,
    ...(storage.path ? { storagePath: storage.path } : {}),
  });
});

app.post("/api/auth/send-otp", async (req, res) => {
  const db = await readDb();
  const phone = asTrimmedText(req.body?.phone);
  assert(phone, badRequest("请输入手机号"));
  const code = db.otp[phone] || "246810";
  res.json({ phone, code, expiresIn: 300 });
});

app.post("/api/auth/reset-password", async (req, res) => {
  const db = await readDb();
  const phone = asTrimmedText(req.body?.phone);
  const otp = asTrimmedText(req.body?.otp);
  const newPassword = asTrimmedText(req.body?.newPassword);
  const user = db.users.find((item) => item.phone === phone);

  assert(phone && otp && newPassword, badRequest("请完整填写手机号、验证码和新密码"));
  assert(user, notFound("未找到对应账号"));
  assert(db.otp[phone] === otp, unauthorized("短信验证码错误"));
  assert(String(newPassword).length >= 6, badRequest("新密码至少需要 6 位"));

  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  await writeDb(db);
  res.json({ ok: true, message: "密码已重置，请使用新密码登录" });
});

app.post("/api/auth/login", async (req, res) => {
  const db = await readDb();
  const { mode, identifier, password, phone, otp } = req.body || {};

  let user = null;
  if (mode === "password") {
    const normalizedIdentifier = asTrimmedText(identifier);
    user = db.users.find((item) => item.email === normalizedIdentifier || item.phone === normalizedIdentifier);
    assert(user && bcrypt.compareSync(password || "", user.passwordHash), unauthorized("账号或密码错误"));
  } else if (mode === "otp") {
    const normalizedPhone = asTrimmedText(phone);
    user = db.users.find((item) => item.phone === normalizedPhone);
    assert(user && db.otp[normalizedPhone] === asTrimmedText(otp), unauthorized("短信验证码错误"));
  } else {
    throw badRequest("不支持的登录方式");
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

app.post("/api/auth/register", async (req, res) => {
  const db = await readDb();
  const { role, agreement } = req.body || {};
  const applicant = asTrimmedText(req.body?.applicant);
  const email = asTrimmedText(req.body?.email);
  const siteName = asTrimmedText(req.body?.siteName);
  const siteCode = asTrimmedText(req.body?.siteCode);
  assert(agreement, badRequest("请先勾选服务协议"));
  assert(applicant && email && siteName && siteCode, badRequest("请完整填写注册资料"));
  assert(["merchant", "admin"].includes(role), badRequest("注册角色仅支持商户端或管理端"));

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
  await writeDb(db);
  res.json({ applicationId, status: "pending" });
});

app.get("/api/dashboard", authMiddleware, async (req, res) => {
  const db = await readDb();
  res.json(dashboardPayload(db, req.user));
});

app.post("/api/ocr/recognize", authMiddleware, async (req, res) => {
  if (!requireConsoleRole(req, res)) return;

  const db = await readDb();
  const result = recognizeVehicle(req.body || {}, db.vehicleProfiles);
  db.lastOcr = result;
  await writeDb(db);
  res.json(result);
});

app.put("/api/spaces/:code", authMiddleware, async (req, res) => {
  if (!requireConsoleRole(req, res)) return;

  const db = await readDb();
  const space = db.spaces.find((item) => item.code === req.params.code);
  assert(space, notFound("未找到对应车位"));

  try {
    updateSpaceState(space, (req.body || {}).action);
  } catch (error) {
    throw badRequest(error.message);
  }

  await writeDb(db);
  res.json({
    space,
    map: db.spaces,
    overview: buildOverview(db.spaces),
  });
});

app.post("/api/user/reservations", authMiddleware, async (req, res) => {
  if (!requireUserRole(req, res)) return;

  const db = await readDb();
  const portal = ensurePortal(db, req.user.sub);
  const body = req.body || {};
  const site = asTrimmedText(body.site);
  const time = asTrimmedText(body.time);
  assert(site && time, badRequest("请填写预约车位和预约时段"));

  const reservation = {
    id: nextId("reserve"),
    site,
    time,
    status: "已确认",
  };

  portal.reservations.unshift(reservation);
  prependNotice(
    portal,
    createPortalNotice({
      id: nextId("notice"),
      title: "预约成功",
      message: `${reservation.site} 已为你锁定，请在预约时段内到场。`,
    }),
  );
  portal.summary = normalizeUserPortal(portal).summary;

  await writeDb(db);
  res.json({ reservation, userPortal: portal });
});

app.post("/api/user/checkout", authMiddleware, async (req, res) => {
  if (!requireUserRole(req, res)) return;

  const db = await readDb();
  const portal = ensurePortal(db, req.user.sub);
  const body = req.body || {};

  const activeParking = portal.activeParking;
  assert(
    activeParking &&
      activeParking.billingStatus !== "已完成支付，可离场" &&
      activeParking.billingStatus !== "当前无在场车辆",
    badRequest("当前没有可结算的停车记录"),
  );

  const entry = db.entries.find(
    (item) =>
      item.status === "active" &&
      item.plateNumber === activeParking.plateNumber &&
      item.spaceCode === activeParking.spaceCode,
  );

  assert(entry, notFound("未找到当前在场车辆记录"));

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
    invoiceStatus: "未申请",
  });
  prependNotice(
    portal,
    createPortalNotice({
      id: nextId("notice"),
      title: "离场缴费完成",
      message: `${entry.plateNumber} 已完成支付，可直接离场。`,
      type: "billing",
      status: "success",
    }),
  );
  portal.activeParking = {
    plateNumber: entry.plateNumber,
    lotName: activeParking.lotName,
    spaceCode: entry.spaceCode,
    entryLabel: "本次停车已完成结算",
    durationLabel: formatDurationLabel(bill.durationMinutes),
    currentAmount: 0,
    billingStatus: "已完成支付，可离场",
  };
  portal.summary = normalizeUserPortal(portal).summary;

  await writeDb(db);
  res.json({ bill, payment, userPortal: portal });
});

app.post("/api/user/support-tickets", authMiddleware, async (req, res) => {
  if (!requireUserRole(req, res)) return;

  const db = await readDb();
  const portal = ensurePortal(db, req.user.sub);
  const topic = asTrimmedText(req.body?.topic);
  const content = asTrimmedText(req.body?.content);
  const contact = asTrimmedText(req.body?.contact);

  assert(topic && content && contact, badRequest("请完整填写工单主题、联系方式和问题描述"));

  const ticket = createPortalNotice({
    id: nextId("ticket"),
    title: `工单已创建：${topic}`,
    message: `${content}。客服将通过 ${contact} 与你联系。`,
    type: "support",
    status: "处理中",
  });

  prependNotice(portal, ticket);
  await writeDb(db);
  res.json({ ticket, userPortal: portal });
});

app.post("/api/user/invoices", authMiddleware, async (req, res) => {
  if (!requireUserRole(req, res)) return;

  const db = await readDb();
  const portal = ensurePortal(db, req.user.sub);
  const orderId = asTrimmedText(req.body?.orderId);
  const invoiceTitle = asTrimmedText(req.body?.invoiceTitle);
  const invoiceEmail = asTrimmedText(req.body?.invoiceEmail);

  assert(invoiceTitle && invoiceEmail, badRequest("请填写发票抬头和接收邮箱"));

  const order = portal.orders.find((item) => item.id === orderId) || portal.orders[0];
  assert(order, notFound("暂无可申请发票的停车订单"));
  assert(order.invoiceStatus !== "已开票", conflict("该订单已完成开票，无需重复申请"));

  order.invoiceStatus = "申请中";
  order.invoiceTitle = invoiceTitle;
  order.invoiceEmail = invoiceEmail;
  order.invoiceRequestedAt = new Date().toISOString();

  prependNotice(
    portal,
    createPortalNotice({
      id: nextId("notice"),
      title: "电子发票申请已提交",
      message: `${order.plateNumber} 的停车订单已进入开票队列，结果将发送到 ${invoiceEmail}。`,
      type: "invoice",
      status: "申请中",
    }),
  );
  portal.summary = normalizeUserPortal(portal).summary;

  await writeDb(db);
  res.json({ order, userPortal: portal });
});

app.post("/api/user/membership/renewals", authMiddleware, async (req, res) => {
  if (!requireUserRole(req, res)) return;

  const db = await readDb();
  const portal = ensurePortal(db, req.user.sub);
  const months = Number(req.body?.months);
  const paymentChannel = asTrimmedText(req.body?.paymentChannel) || "扫码支付";
  const couponCode = asTrimmedText(req.body?.couponCode);

  assert(Number.isInteger(months) && months > 0 && months <= 12, badRequest("续费月数仅支持 1 到 12 个月"));

  const unitPrice = Number(portal.membership.monthlyRate || 680);
  const coupon = couponCode ? findCoupon(db, couponCode) : null;
  const discountAmount = coupon?.type === "amount" ? Number(coupon.value) : 0;
  const amount = Math.max(0, unitPrice * months - discountAmount);
  const expiresBase = new Date(portal.membership.expiresAt || new Date());
  const nextExpiry = new Date(expiresBase);
  nextExpiry.setMonth(nextExpiry.getMonth() + months);

  const renewal = {
    id: nextId("renew"),
    months,
    amount,
    paymentChannel,
    couponCode: couponCode || null,
    status: "已生效",
    createdAt: new Date().toISOString(),
    expiresAt: nextExpiry.toISOString().slice(0, 10),
  };

  portal.membership.expiresAt = renewal.expiresAt;
  portal.membership.monthlyRate = unitPrice;
  portal.membership.renewalHistory = [renewal, ...(portal.membership.renewalHistory || [])].slice(0, 10);
  prependNotice(
    portal,
    createPortalNotice({
      id: nextId("notice"),
      title: "月租续费成功",
      message: `${months} 个月月租已续费成功，新的到期日为 ${renewal.expiresAt}。`,
      type: "renewal",
      status: "success",
    }),
  );

  await writeDb(db);
  res.json({ renewal, userPortal: portal });
});

app.post("/api/entries", authMiddleware, async (req, res) => {
  if (!requireConsoleRole(req, res)) return;

  const db = await readDb();
  const body = req.body || {};
  const ocr = recognizeVehicle({ gateId: body.gateId, imageHint: body.plateNumber }, db.vehicleProfiles);
  db.lastOcr = ocr;

  if (ocr.listType === "blacklist") {
    await writeDb(db);
    throw forbidden(ocr.gateActionMessage);
  }

  const existing = db.entries.find((entry) => entry.status === "active" && entry.plateNumber.replace(/\s+/g, "") === ocr.plateNumber.replace(/\s+/g, ""));
  if (existing) {
    await writeDb(db);
    throw conflict("该车辆已在场内，无需重复入场");
  }

  const space = occupySpace(db, body.plateType || ocr.vehicleType);
  assert(space, badRequest("当前停车场已无可用车位"));

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
  await writeDb(db);
  res.json({ entry, ocr, message: ocr.gateActionMessage, overview: buildOverview(db.spaces) });
});

app.post("/api/exits", authMiddleware, async (req, res) => {
  if (!requireConsoleRole(req, res)) return;

  const db = await readDb();
  const body = req.body || {};
  const entry = db.entries.find((item) => item.status === "active" && (item.id === body.entryId || item.plateNumber === body.plateNumber));
  assert(entry, notFound("未找到有效的在场车辆记录"));

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
  await writeDb(db);
  res.json({ bill, payment, overview: buildOverview(db.spaces) });
});

app.put("/api/billing/config", authMiddleware, async (req, res) => {
  if (!requireAdminRole(req, res)) return;

  const db = await readDb();
  const body = req.body || {};
  assert(Number(body.freeMinutes) >= 0, badRequest("免费时长不能小于 0"));
  assert(Number(body.hourlyRate) >= 0 && Number(body.stepRate) >= 0, badRequest("计费金额不能小于 0"));
  assert(Number(body.capAmount) >= 0, badRequest("封顶金额不能小于 0"));
  db.pricing = {
    ...db.pricing,
    freeMinutes: Number(body.freeMinutes),
    hourlyRate: Number(body.hourlyRate),
    stepMinutes: Number(body.stepMinutes || 30),
    stepRate: Number(body.stepRate),
    capAmount: Number(body.capAmount),
    nightRate: Number(body.nightRate || db.pricing.nightRate),
  };
  await writeDb(db);
  res.json(db.pricing);
});

app.use("/api", (_req, _res, next) => {
  next(notFound("未找到对应 API 接口"));
});

app.use(jsonErrorHandler);
app.use(express.static(distPath));
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

await ensureStorageReady();

app.listen(port, () => {
  console.log(`ParkSphere API running at http://localhost:${port}`);
});
