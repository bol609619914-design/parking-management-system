function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function formatPortalCount(value, unit) {
  return `${value} ${unit}`;
}

export function getPendingInvoiceCount(portal) {
  return toArray(portal.orders).filter(
    (order) => order.invoiceStatus && order.invoiceStatus !== "已开票" && order.invoiceStatus !== "已作废",
  ).length;
}

export function createPortalNotice({
  id,
  title,
  message,
  time = "刚刚",
  type = "system",
  status,
}) {
  return {
    id,
    title,
    message,
    time,
    type,
    ...(status ? { status } : {}),
  };
}

export function buildUserSummary(portal) {
  const coupons = toArray(portal.coupons);
  const orders = toArray(portal.orders);
  const activeParking = toObject(portal.activeParking);
  const parkingCount = orders.length + (activeParking.billingStatus && activeParking.billingStatus !== "当前无在场车辆" ? 1 : 0);

  return [
    {
      label: "可用优惠券",
      value: formatPortalCount(coupons.length, "张"),
      hint: "商场发券与停车减免券会自动同步到账户。",
    },
    {
      label: "本月停车次数",
      value: formatPortalCount(parkingCount, "次"),
      hint: "根据历史订单与当前在场记录自动统计。",
    },
    {
      label: "待开电子发票",
      value: formatPortalCount(getPendingInvoiceCount(portal), "笔"),
      hint: "开票申请提交后可在停车订单中追踪处理进度。",
    },
  ];
}

export function normalizeUserPortal(portal) {
  const normalizedMembership = {
    plan: "月租通勤卡",
    expiresAt: "--",
    spaceCode: "--",
    renewalHistory: [],
    ...toObject(portal.membership),
  };
  normalizedMembership.renewalHistory = toArray(normalizedMembership.renewalHistory);

  const normalized = {
    ...toObject(portal),
    summary: [],
    activeParking: {
      plateNumber: "--",
      lotName: "暂无在场车辆",
      spaceCode: "--",
      entryLabel: "当前没有在场停车记录",
      durationLabel: "0 分钟",
      currentAmount: 0,
      billingStatus: "当前无在场车辆",
      ...toObject(portal.activeParking),
    },
    reservations: toArray(portal.reservations),
    coupons: toArray(portal.coupons),
    orders: toArray(portal.orders),
    membership: normalizedMembership,
    notices: toArray(portal.notices),
  };

  normalized.summary = buildUserSummary(normalized);
  return normalized;
}
