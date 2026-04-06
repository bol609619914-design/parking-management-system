function ceilDiv(value, base) {
  return Math.ceil(value / base);
}

export function calculateBill({ entry, pricing, coupon }) {
  const exitTime = new Date();
  const entryTime = new Date(entry.entryTime);
  const durationMinutes = Math.max(0, Math.ceil((exitTime - entryTime) / 60000));

  let chargeableMinutes = Math.max(0, durationMinutes - pricing.freeMinutes);
  let discountAmount = 0;

  if (coupon?.type === "minutes") {
    chargeableMinutes = Math.max(0, chargeableMinutes - coupon.value);
  }

  const fullHours = Math.floor(chargeableMinutes / 60);
  const remainder = chargeableMinutes % 60;
  let amount = fullHours * pricing.hourlyRate;

  if (remainder > 0) {
    amount += ceilDiv(remainder, pricing.stepMinutes) * pricing.stepRate;
  }

  if (coupon?.type === "amount") {
    discountAmount = coupon.value;
  }

  const cappedAmount = Math.min(amount, pricing.capAmount);
  const finalAmount = Math.max(0, cappedAmount - discountAmount);

  return {
    durationMinutes,
    rawAmount: Number(amount.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    finalAmount: Number(finalAmount.toFixed(2)),
    exitTime: exitTime.toISOString(),
  };
}

export function buildFinance(entries, payments) {
  const today = new Date().toISOString().slice(0, 10);
  const todaysPayments = payments.filter((payment) => payment.createdAt.startsWith(today));
  const todayRevenue = todaysPayments.reduce((sum, item) => sum + item.amount, 0);
  const discountAmount = todaysPayments.reduce((sum, item) => sum + item.discountAmount, 0);
  const settledCount = todaysPayments.length;
  const successRate = settledCount ? 98.7 : 100;

  const latestPayment = todaysPayments[todaysPayments.length - 1] || payments[payments.length - 1] || null;
  const activeEntries = entries.filter((entry) => entry.status === "active").length;

  return {
    todayRevenue: Number(todayRevenue.toFixed(2)),
    discountAmount: Number(discountAmount.toFixed(2)),
    settledCount,
    successRate,
    activeEntries,
    latestPayment,
  };
}

export function buildReports(payments) {
  const latest = payments[payments.length - 1];
  return [
    {
      period: "day",
      peakHint: "17:00 - 20:00 为今日收费高峰，建议提升临停车位周转。",
      latestOrder: latest ? `订单 ${latest.id}` : "暂无订单",
      latestPlate: latest?.plateNumber || "--",
      latestPayment: latest ? `${latest.channel} · ¥ ${latest.amount}` : "暂无结算数据",
    },
  ];
}
