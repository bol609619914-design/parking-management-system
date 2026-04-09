import jwt from "jsonwebtoken";
import { buildFinance, buildReports } from "./billing.js";
import { notFound, unauthorized, assert } from "./http.js";
import { normalizeUserPortal } from "./userPortal.js";

export function createAppServices({ jwtSecret }) {
  function signToken(user) {
    return jwt.sign({ sub: user.id, role: user.role, name: user.name }, jwtSecret, { expiresIn: "8h" });
  }

  function authMiddleware(req, _res, next) {
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
    const space =
      db.spaces.find((item) => item.status === "available" && item.type === preferredType) ||
      db.spaces.find((item) => item.status === "available");
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
        throw new Error("不支持的车位操作");
    }
    return space;
  }

  return {
    signToken,
    authMiddleware,
    buildOverview,
    requireUserRole,
    requireConsoleRole,
    requireAdminRole,
    prependNotice,
    ensurePortal,
    formatDurationLabel,
    dashboardPayload,
    findCoupon,
    occupySpace,
    releaseSpace,
    updateSpaceState,
  };
}
