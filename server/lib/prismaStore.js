import { getPrismaClient } from "./prisma.js";

const defaultPricing = {
  freeMinutes: 30,
  hourlyRate: 8,
  stepMinutes: 30,
  stepRate: 4,
  capAmount: 88,
  nightRate: 5,
};

function toIso(value) {
  return value ? new Date(value).toISOString() : undefined;
}

function dateOrNow(value) {
  return value ? new Date(value) : new Date();
}

async function createManyIfAny(model, data) {
  if (!data.length) return;
  await model.createMany({ data });
}

function buildVehicleProfileMap(rows) {
  return Object.fromEntries(
    rows.map((row) => [
      row.plateNumber,
      {
        listType: row.listType,
        owner: row.owner,
        vehicleType: row.vehicleType,
        ...(row.reason ? { reason: row.reason } : {}),
      },
    ]),
  );
}

function buildOtpMap(rows) {
  return Object.fromEntries(rows.map((row) => [row.phone, row.code]));
}

function buildUserPortalMap(rows) {
  return Object.fromEntries(
    rows.map((row) => [
      row.userId,
      {
        summary: row.summary,
        activeParking: row.activeParking,
        reservations: row.reservations,
        coupons: row.coupons,
        orders: row.orders,
        membership: row.membership,
        notices: row.notices,
      },
    ]),
  );
}

function serializeEntry(row) {
  return {
    id: row.id,
    plateNumber: row.plateNumber,
    plateType: row.plateType,
    entryTime: toIso(row.entryTime),
    gateIn: row.gateIn,
    spaceCode: row.spaceCode,
    status: row.status,
    ...(row.exitTime ? { exitTime: toIso(row.exitTime) } : {}),
    ...(row.gateOut ? { gateOut: row.gateOut } : {}),
    ...(row.billing ? { billing: row.billing } : {}),
  };
}

function serializePayment(row) {
  return {
    id: row.id,
    entryId: row.entryId,
    plateNumber: row.plateNumber,
    amount: row.amount,
    discountAmount: row.discountAmount,
    channel: row.channel,
    createdAt: toIso(row.createdAt),
  };
}

export async function readDbFromPrisma() {
  const prisma = getPrismaClient();
  const [
    users,
    applications,
    pricing,
    gates,
    alerts,
    spaces,
    vehicleProfiles,
    coupons,
    entries,
    payments,
    otpCodes,
    ocrSnapshot,
    userPortals,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.application.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.pricingConfig.findFirst(),
    prisma.gate.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.alert.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.space.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.vehicleProfile.findMany({ orderBy: { plateNumber: "asc" } }),
    prisma.coupon.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.entry.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.payment.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.otpCode.findMany({ orderBy: { phone: "asc" } }),
    prisma.ocrSnapshot.findFirst({ where: { id: 1 } }),
    prisma.userPortal.findMany({ orderBy: { userId: "asc" } }),
  ]);

  return {
    users: users.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      email: row.email,
      phone: row.phone,
      passwordHash: row.passwordHash,
    })),
    applications: applications.map((row) => ({
      id: row.id,
      applicant: row.applicant,
      email: row.email,
      role: row.role,
      siteName: row.siteName,
      siteCode: row.siteCode,
      status: row.status,
      createdAt: toIso(row.createdAt),
    })),
    pricing: pricing
      ? {
          freeMinutes: pricing.freeMinutes,
          hourlyRate: pricing.hourlyRate,
          stepMinutes: pricing.stepMinutes,
          stepRate: pricing.stepRate,
          capAmount: pricing.capAmount,
          nightRate: pricing.nightRate,
        }
      : { ...defaultPricing },
    gates: gates.map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
    })),
    alerts: alerts.map((row) => ({
      id: row.id,
      title: row.title,
      message: row.message,
      level: row.level,
    })),
    spaces: spaces.map((row) => ({
      code: row.code,
      status: row.status,
      type: row.type,
    })),
    vehicleProfiles: buildVehicleProfileMap(vehicleProfiles),
    coupons: coupons.map((row) => ({
      code: row.code,
      type: row.type,
      value: row.value,
      name: row.name,
    })),
    entries: entries.map(serializeEntry),
    payments: payments.map(serializePayment),
    otp: buildOtpMap(otpCodes),
    lastOcr: ocrSnapshot
      ? {
          gateId: ocrSnapshot.gateId,
          plateNumber: ocrSnapshot.plateNumber,
          normalizedPlate: ocrSnapshot.normalizedPlate,
          confidence: ocrSnapshot.confidence,
          provider: ocrSnapshot.provider,
          listType: ocrSnapshot.listType,
          vehicleType: ocrSnapshot.vehicleType,
          gateActionMessage: ocrSnapshot.gateActionMessage,
        }
      : null,
    userPortals: buildUserPortalMap(userPortals),
  };
}

export async function writeDbToPrisma(data) {
  const prisma = getPrismaClient();
  await prisma.userPortal.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.entry.deleteMany();
  await prisma.application.deleteMany();
  await prisma.otpCode.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.gate.deleteMany();
  await prisma.space.deleteMany();
  await prisma.vehicleProfile.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.ocrSnapshot.deleteMany();
  await prisma.pricingConfig.deleteMany();
  await prisma.user.deleteMany();

  await createManyIfAny(
    prisma.user,
    (data.users || []).map((row, index) => ({
      id: row.id,
      sortOrder: index,
      name: row.name,
      role: row.role,
      email: row.email,
      phone: row.phone,
      passwordHash: row.passwordHash,
    })),
  );

  await createManyIfAny(
    prisma.application,
    (data.applications || []).map((row, index) => ({
      id: row.id,
      sortOrder: index,
      applicant: row.applicant,
      email: row.email,
      role: row.role,
      siteName: row.siteName,
      siteCode: row.siteCode,
      status: row.status,
      createdAt: dateOrNow(row.createdAt),
    })),
  );

  if (data.pricing) {
    await prisma.pricingConfig.create({
      data: {
        id: 1,
        freeMinutes: Number(data.pricing.freeMinutes),
        hourlyRate: Number(data.pricing.hourlyRate),
        stepMinutes: Number(data.pricing.stepMinutes),
        stepRate: Number(data.pricing.stepRate),
        capAmount: Number(data.pricing.capAmount),
        nightRate: Number(data.pricing.nightRate),
      },
    });
  }

  await createManyIfAny(
    prisma.gate,
    (data.gates || []).map((row, index) => ({
      id: row.id,
      sortOrder: index,
      name: row.name,
      status: row.status,
    })),
  );

  await createManyIfAny(
    prisma.alert,
    (data.alerts || []).map((row, index) => ({
      id: row.id,
      sortOrder: index,
      title: row.title,
      message: row.message,
      level: row.level,
    })),
  );

  await createManyIfAny(
    prisma.space,
    (data.spaces || []).map((row, index) => ({
      code: row.code,
      sortOrder: index,
      status: row.status,
      type: row.type,
    })),
  );

  await createManyIfAny(
    prisma.vehicleProfile,
    Object.entries(data.vehicleProfiles || {}).map(([plateNumber, row]) => ({
      plateNumber,
      listType: row.listType,
      owner: row.owner,
      vehicleType: row.vehicleType,
      ...(row.reason ? { reason: row.reason } : {}),
    })),
  );

  await createManyIfAny(
    prisma.coupon,
    (data.coupons || []).map((row, index) => ({
      code: row.code,
      sortOrder: index,
      type: row.type,
      value: Number(row.value),
      name: row.name,
    })),
  );

  await createManyIfAny(
    prisma.entry,
    (data.entries || []).map((row, index) => ({
      id: row.id,
      sortOrder: index,
      plateNumber: row.plateNumber,
      plateType: row.plateType,
      entryTime: dateOrNow(row.entryTime),
      gateIn: row.gateIn,
      spaceCode: row.spaceCode,
      status: row.status,
      ...(row.exitTime ? { exitTime: dateOrNow(row.exitTime) } : {}),
      ...(row.gateOut ? { gateOut: row.gateOut } : {}),
      ...(row.billing ? { billing: row.billing } : {}),
    })),
  );

  await createManyIfAny(
    prisma.payment,
    (data.payments || []).map((row, index) => ({
      id: row.id,
      sortOrder: index,
      entryId: row.entryId,
      plateNumber: row.plateNumber,
      amount: Number(row.amount),
      discountAmount: Number(row.discountAmount),
      channel: row.channel,
      createdAt: dateOrNow(row.createdAt),
    })),
  );

  await createManyIfAny(
    prisma.otpCode,
    Object.entries(data.otp || {}).map(([phone, code]) => ({
      phone,
      code,
    })),
  );

  if (data.lastOcr) {
    await prisma.ocrSnapshot.create({
      data: {
        id: 1,
        gateId: data.lastOcr.gateId,
        plateNumber: data.lastOcr.plateNumber,
        normalizedPlate: data.lastOcr.normalizedPlate,
        confidence: data.lastOcr.confidence,
        provider: data.lastOcr.provider,
        listType: data.lastOcr.listType,
        vehicleType: data.lastOcr.vehicleType,
        gateActionMessage: data.lastOcr.gateActionMessage,
      },
    });
  }

  await createManyIfAny(
    prisma.userPortal,
    Object.entries(data.userPortals || {}).map(([userId, portal]) => ({
      userId,
      summary: portal.summary || [],
      activeParking: portal.activeParking || {},
      reservations: portal.reservations || [],
      coupons: portal.coupons || [],
      orders: portal.orders || [],
      membership: portal.membership || {},
      notices: portal.notices || [],
    })),
  );
}
