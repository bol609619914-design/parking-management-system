import { calculateBill } from "../lib/billing.js";
import { recognizeVehicle } from "../lib/ocr.js";
import { badRequest, conflict, forbidden, notFound, assert } from "../lib/http.js";

export function registerConsoleRoutes(app, { readDb, writeDb, nextId, services, getStorageMeta }) {
  app.get("/api/health", (_req, res) => {
    const storage = getStorageMeta();
    res.json({
      ok: true,
      now: new Date().toISOString(),
      storage: storage.mode,
      ...(storage.path ? { storagePath: storage.path } : {}),
    });
  });

  app.get("/api/dashboard", services.authMiddleware, async (req, res) => {
    const db = await readDb();
    res.json(services.dashboardPayload(db, req.user));
  });

  app.post("/api/ocr/recognize", services.authMiddleware, async (req, res) => {
    if (!services.requireConsoleRole(req, res)) return;

    const db = await readDb();
    const result = recognizeVehicle(req.body || {}, db.vehicleProfiles);
    db.lastOcr = result;
    await writeDb(db);
    res.json(result);
  });

  app.put("/api/spaces/:code", services.authMiddleware, async (req, res) => {
    if (!services.requireConsoleRole(req, res)) return;

    const db = await readDb();
    const space = db.spaces.find((item) => item.code === req.params.code);
    assert(space, notFound("未找到对应车位"));

    try {
      services.updateSpaceState(space, (req.body || {}).action);
    } catch (error) {
      throw badRequest(error.message);
    }

    await writeDb(db);
    res.json({
      space,
      map: db.spaces,
      overview: services.buildOverview(db.spaces),
    });
  });

  app.post("/api/entries", services.authMiddleware, async (req, res) => {
    if (!services.requireConsoleRole(req, res)) return;

    const db = await readDb();
    const body = req.body || {};
    const ocr = recognizeVehicle({ gateId: body.gateId, imageHint: body.plateNumber }, db.vehicleProfiles);
    db.lastOcr = ocr;

    if (ocr.listType === "blacklist") {
      await writeDb(db);
      throw forbidden(ocr.gateActionMessage);
    }

    const existing = db.entries.find(
      (entry) => entry.status === "active" && entry.plateNumber.replace(/\s+/g, "") === ocr.plateNumber.replace(/\s+/g, ""),
    );
    if (existing) {
      await writeDb(db);
      throw conflict("该车辆已在场内，无需重复入场");
    }

    const space = services.occupySpace(db, body.plateType || ocr.vehicleType);
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
    res.json({ entry, ocr, message: ocr.gateActionMessage, overview: services.buildOverview(db.spaces) });
  });

  app.post("/api/exits", services.authMiddleware, async (req, res) => {
    if (!services.requireConsoleRole(req, res)) return;

    const db = await readDb();
    const body = req.body || {};
    const entry = db.entries.find((item) => item.status === "active" && (item.id === body.entryId || item.plateNumber === body.plateNumber));
    assert(entry, notFound("未找到有效的在场车辆记录"));

    const coupon = services.findCoupon(db, body.couponCode);
    const bill = calculateBill({ entry, pricing: db.pricing, coupon });

    entry.status = "closed";
    entry.exitTime = bill.exitTime;
    entry.gateOut = "gate-east-out";
    entry.billing = bill;
    services.releaseSpace(db, entry.spaceCode);

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
    res.json({ bill, payment, overview: services.buildOverview(db.spaces) });
  });

  app.put("/api/billing/config", services.authMiddleware, async (req, res) => {
    if (!services.requireAdminRole(req, res)) return;

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
}
