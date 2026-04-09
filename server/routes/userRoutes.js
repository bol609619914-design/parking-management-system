import { calculateBill } from "../lib/billing.js";
import { badRequest, conflict, notFound, assert, asTrimmedText } from "../lib/http.js";
import { createPortalNotice, normalizeUserPortal } from "../lib/userPortal.js";

export function registerUserRoutes(app, { readDb, writeDb, nextId, services }) {
  app.post("/api/user/reservations", services.authMiddleware, async (req, res) => {
    if (!services.requireUserRole(req, res)) return;

    const db = await readDb();
    const portal = services.ensurePortal(db, req.user.sub);
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
    services.prependNotice(
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

  app.post("/api/user/checkout", services.authMiddleware, async (req, res) => {
    if (!services.requireUserRole(req, res)) return;

    const db = await readDb();
    const portal = services.ensurePortal(db, req.user.sub);
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

    portal.orders.unshift({
      id: payment.id,
      plateNumber: entry.plateNumber,
      site: activeParking.lotName,
      duration: services.formatDurationLabel(bill.durationMinutes),
      amount: bill.finalAmount,
      channel: payment.channel,
      invoiceStatus: "未申请",
    });
    services.prependNotice(
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
      durationLabel: services.formatDurationLabel(bill.durationMinutes),
      currentAmount: 0,
      billingStatus: "已完成支付，可离场",
    };
    portal.summary = normalizeUserPortal(portal).summary;

    await writeDb(db);
    res.json({ bill, payment, userPortal: portal });
  });

  app.post("/api/user/support-tickets", services.authMiddleware, async (req, res) => {
    if (!services.requireUserRole(req, res)) return;

    const db = await readDb();
    const portal = services.ensurePortal(db, req.user.sub);
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

    services.prependNotice(portal, ticket);
    await writeDb(db);
    res.json({ ticket, userPortal: portal });
  });

  app.post("/api/user/invoices", services.authMiddleware, async (req, res) => {
    if (!services.requireUserRole(req, res)) return;

    const db = await readDb();
    const portal = services.ensurePortal(db, req.user.sub);
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

    services.prependNotice(
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

  app.post("/api/user/membership/renewals", services.authMiddleware, async (req, res) => {
    if (!services.requireUserRole(req, res)) return;

    const db = await readDb();
    const portal = services.ensurePortal(db, req.user.sub);
    const months = Number(req.body?.months);
    const paymentChannel = asTrimmedText(req.body?.paymentChannel) || "扫码支付";
    const couponCode = asTrimmedText(req.body?.couponCode);

    assert(Number.isInteger(months) && months > 0 && months <= 12, badRequest("续费月数仅支持 1 到 12 个月"));

    const unitPrice = Number(portal.membership.monthlyRate || 680);
    const coupon = couponCode ? services.findCoupon(db, couponCode) : null;
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
    services.prependNotice(
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
}
