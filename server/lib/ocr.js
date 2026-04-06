function normalizePlate(value = "") {
  return value.replace(/\s+/g, "").replace(/\u00B7/g, "").toUpperCase();
}

function repairProvincePrefix(value) {
  if (!value) return value;
  if (value.startsWith("?")) return "\u7CA4" + value.slice(1);
  if (value.startsWith("\uFF1F")) return "\u7CA4" + value.slice(1);
  return value;
}

export function recognizeVehicle({ imageHint, gateId }, vehicleProfiles) {
  const normalized = repairProvincePrefix(normalizePlate(imageHint || "\u7CA4BA839Q"));
  const prettyPlate = normalized.length > 2 ? `${normalized.slice(0, 2)} ${normalized.slice(2)}` : normalized;
  const profile = vehicleProfiles[normalized] || { listType: "unknown", vehicleType: "temporary" };

  let gateActionMessage = "\u8BF7\u4EBA\u5DE5\u590D\u6838\u540E\u653E\u884C";
  if (profile.listType === "whitelist") {
    gateActionMessage = profile.vehicleType === "fixed"
      ? "\u6B22\u8FCE\u56DE\u5BB6\uFF0C\u56FA\u5B9A\u8F66\u81EA\u52A8\u8D77\u6746"
      : "\u5C0A\u4EAB\u9884\u7EA6\u901A\u9053\uFF0CVIP \u81EA\u52A8\u653E\u884C";
  }
  if (profile.listType === "blacklist") {
    gateActionMessage = `\u5DF2\u62E6\u622A\uFF1A${profile.reason || "\u547D\u4E2D\u9ED1\u540D\u5355"}`;
  }

  return {
    gateId,
    plateNumber: prettyPlate,
    normalizedPlate: normalized,
    confidence: 98,
    provider: process.env.OCR_PROVIDER_NAME || "Local OCR Adapter",
    listType: profile.listType,
    vehicleType: profile.vehicleType,
    gateActionMessage,
  };
}
