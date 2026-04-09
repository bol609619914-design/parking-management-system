import bcrypt from "bcryptjs";
import { badRequest, notFound, unauthorized, assert, asTrimmedText } from "../lib/http.js";

export function registerAuthRoutes(app, { readDb, writeDb, nextId, services }) {
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
      token: services.signToken(user),
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
}
