<script setup>
import { computed, reactive, ref } from "vue";
import { api } from "./api";

const loginMode = ref("password");
const authScreen = ref("login");
const activeMenu = ref("overview");
const registrationStep = ref(0);
const loading = ref(false);
const notificationsOpen = ref(false);
const toast = reactive({ visible: false, title: "", message: "" });
const auth = reactive({ token: "", user: null });

const menus = [
  { key: "overview", label: "指挥中心", hint: "实时概览" },
  { key: "access", label: "出入管理", hint: "识别与闸机" },
  { key: "billing", label: "计费引擎", hint: "计费规则" },
  { key: "spaces", label: "车位管理", hint: "地图与预约" },
  { key: "finance", label: "财务审计", hint: "流水与报表" },
];

const loginForm = reactive({
  identifier: "",
  password: "",
  phone: "",
  otp: "",
  remember: true,
  sliderVerified: false,
});

const registration = reactive({
  applicant: "陈嘉怡",
  email: "merchant@demo.com",
  role: "merchant",
  siteName: "星港商业中心停车场",
  siteCode: "XG-A2-008",
  agreement: true,
});

const dashboard = reactive({
  overview: { total: 0, available: 0, fixed: 0, temporary: 0 },
  alerts: [],
  ocr: null,
  pricing: null,
  map: [],
  finance: null,
  reports: [],
  gates: [],
  userPortal: null,
});

const gateForm = reactive({
  gateId: "gate-east-in",
  plateNumber: "粤B A839Q",
  plateType: "temporary",
  couponCode: "MALL-20",
  entryId: "",
});

const pricingForm = reactive({
  freeMinutes: 30,
  capAmount: 88,
  hourlyRate: 8,
  stepMinutes: 30,
  stepRate: 4,
  nightRate: 5,
});

const selectedSpaceCode = ref("A-01");

const roleLabel = computed(() => (auth.user?.role === "admin" ? "管理端" : "商户端"));
const plateResult = computed(() => dashboard.ocr?.plateNumber || "等待识别");
const currentReport = computed(() => dashboard.reports[0] || null);
const currentMenu = computed(() => menus.find((item) => item.key === activeMenu.value));
const selectedSpace = computed(() => dashboard.map.find((space) => space.code === selectedSpaceCode.value) || dashboard.map[0] || null);

function notify(title, message) {
  toast.title = title;
  toast.message = message;
  toast.visible = true;
  window.setTimeout(() => {
    toast.visible = false;
  }, 3200);
}

async function handleSendOtp() {
  try {
    const result = await api.sendOtp(loginForm.phone);
    loginForm.otp = result.code;
    notify("验证码已发送", `测试环境验证码：${result.code}`);
  } catch (error) {
    notify("发送失败", error.message);
  }
}

async function loadDashboard() {
  if (!auth.token) return;
  const result = await api.getDashboard(auth.token);
  Object.assign(dashboard, result);
  if (result.pricing) Object.assign(pricingForm, result.pricing);
  if (result.ocr?.plateNumber) gateForm.plateNumber = result.ocr.plateNumber;
  if (!selectedSpaceCode.value || !result.map.some((space) => space.code === selectedSpaceCode.value)) {
    selectedSpaceCode.value = result.map[0]?.code || "";
  }
}

async function handleLogin() {
  if (!loginForm.sliderVerified) {
    notify("请完成滑块验证", "登录前需要先通过安全校验。");
    return;
  }

  loading.value = true;
  try {
    const payload =
      loginMode.value === "password"
        ? {
            mode: "password",
            identifier: loginForm.identifier,
            password: loginForm.password,
            remember: loginForm.remember,
          }
        : {
            mode: "otp",
            phone: loginForm.phone,
            otp: loginForm.otp,
            remember: loginForm.remember,
          };

    const result = await api.login(payload);
    auth.token = result.token;
    auth.user = result.user;
    await loadDashboard();
    activeMenu.value = "overview";
    notify("登录成功", `欢迎回来，${result.user.name}`);
  } catch (error) {
    notify("登录失败", error.message);
  } finally {
    loading.value = false;
  }
}

async function handleRegister() {
  try {
    const result = await api.register(registration);
    notify("审核中", `申请编号 ${result.applicationId} 已进入后台审核。`);
    authScreen.value = "login";
    registrationStep.value = 0;
  } catch (error) {
    notify("提交失败", error.message);
  }
}

async function handleRecognize() {
  try {
    const result = await api.recognizePlate(auth.token, {
      gateId: gateForm.gateId,
      imageHint: gateForm.plateNumber,
    });
    dashboard.ocr = result;
    gateForm.plateNumber = result.plateNumber;
    notify("识别完成", `${result.plateNumber}，置信度 ${result.confidence}%`);
  } catch (error) {
    notify("识别失败", error.message);
  }
}

async function handleEntry() {
  try {
    const result = await api.createEntry(auth.token, {
      gateId: gateForm.gateId,
      plateNumber: gateForm.plateNumber,
      plateType: gateForm.plateType,
    });
    gateForm.entryId = result.entry.id;
    dashboard.ocr = result.ocr;
    notify("入场放行", `${result.message}，记录号 ${result.entry.id}`);
    await loadDashboard();
  } catch (error) {
    notify("入场失败", error.message);
  }
}

async function handleExit() {
  try {
    const result = await api.createExit(auth.token, {
      entryId: gateForm.entryId,
      plateNumber: gateForm.plateNumber,
      couponCode: gateForm.couponCode,
      paymentChannel: "扫码支付",
    });
    notify("出场结算成功", `应收 ${result.bill.finalAmount} 元，渠道 ${result.payment.channel}`);
    await loadDashboard();
  } catch (error) {
    notify("出场失败", error.message);
  }
}

async function handleSavePricing() {
  try {
    await api.updatePricing(auth.token, pricingForm);
    notify("计费规则已更新", "新的免费时长与封顶金额已生效。");
    await loadDashboard();
  } catch (error) {
    notify("保存失败", error.message);
  }
}


async function handleSpaceAction(action) {
  if (!selectedSpace.value) return;
  try {
    const result = await api.updateSpace(auth.token, selectedSpace.value.code, { action });
    dashboard.map = result.map;
    dashboard.overview = result.overview;
    selectedSpaceCode.value = result.space.code;
    notify("车位状态已更新", result.space.code + " 已切换为 " + result.space.status);
  } catch (error) {
    notify("车位操作失败", error.message);
  }
}
function handleUserAction(action) {
  const messages = {
    renew: "????????????",
    reserve: "????????????",
    invoice: "??????????",
    support: "??????????",
  };
  notify("????", messages[action] || "??????");
}

function logout() {
  auth.token = "";
  auth.user = null;
  loginForm.sliderVerified = false;
  authScreen.value = "login";
}
</script>

<template>
  <div v-if="!auth.token" class="auth-layout">
    <section class="auth-panel">
      <p class="auth-kicker">&#20572;&#36710;&#22330;&#31649;&#29702;&#31995;&#32479;</p>

      <template v-if="authScreen === 'login'">
        <div class="card-tabs compact">
          <button class="card-tab" :class="{ 'is-active': loginMode === 'password' }" @click="loginMode = 'password'">&#36134;&#21495;&#30331;&#24405;</button>
          <button class="card-tab" :class="{ 'is-active': loginMode === 'otp' }" @click="loginMode = 'otp'">&#25163;&#26426;&#24555;&#25463;&#30331;&#24405;</button>
        </div>

        <div class="login-form auth-form-block">
          <label class="field">
            <span class="field-icon">@</span>
            <input v-if="loginMode === 'password'" v-model="loginForm.identifier" type="text" placeholder="&#37038;&#31665; / &#29992;&#25143;&#21517;" />
            <input v-else v-model="loginForm.phone" type="tel" placeholder="&#25163;&#26426;&#21495;" />
          </label>

          <label class="field" v-if="loginMode === 'password'">
            <span class="field-icon">*</span>
            <input v-model="loginForm.password" type="password" placeholder="&#30331;&#24405;&#23494;&#30721;" />
          </label>

          <div class="otp-row" v-else>
            <label class="field">
              <span class="field-icon">#</span>
              <input v-model="loginForm.otp" type="text" placeholder="&#30701;&#20449;&#39564;&#35777;&#30721;" />
            </label>
            <button class="ghost-button" @click="handleSendOtp">&#21457;&#36865;&#39564;&#35777;&#30721;</button>
          </div>

          <div class="slider-verify" :class="{ verified: loginForm.sliderVerified }" @click="loginForm.sliderVerified = !loginForm.sliderVerified">
            <div class="slider-track">
              <div class="slider-fill"></div>
              <div class="slider-thumb"></div>
              <span>{{ loginForm.sliderVerified ? "&#24050;&#36890;&#36807;&#23433;&#20840;&#39564;&#35777;" : "&#28857;&#20987;&#27169;&#25311;&#28369;&#22359;&#39564;&#35777;" }}</span>
            </div>
          </div>

          <div class="form-row">
            <label class="checkbox">
              <input v-model="loginForm.remember" type="checkbox" />
              <span>&#35760;&#20303;&#25105;</span>
            </label>
            <div class="auth-links">
              <a href="#" class="link-text">&#24536;&#35760;&#23494;&#30721;&#65311;</a>
              <button type="button" class="link-button" @click="authScreen = 'register'">&#27880;&#20876;</button>
            </div>
          </div>

          <button class="primary-button wide" :disabled="loading" @click="handleLogin">{{ loading ? "&#30331;&#24405;&#20013;..." : "&#36827;&#20837;&#25511;&#21046;&#21488;" }}</button>
        </div>
      </template>

      <template v-else>
        <div class="auth-links auth-links-top">
          <button type="button" class="link-button" @click="authScreen = 'login'">&#36820;&#22238;&#30331;&#24405;</button>
        </div>

        <div class="step-progress auth-form-block">
          <div class="step-line"><span class="step-fill" :style="{ width: `${(registrationStep + 1) * 33.33}%` }"></span></div>
          <div class="step-labels">
            <button class="step-label" :class="{ 'is-current': registrationStep === 0 }" @click="registrationStep = 0">&#22522;&#26412;&#20449;&#24687;</button>
            <button class="step-label" :class="{ 'is-current': registrationStep === 1 }" @click="registrationStep = 1">&#22330;&#25152;&#32465;&#23450;</button>
            <button class="step-label" :class="{ 'is-current': registrationStep === 2 }" @click="registrationStep = 2">&#25552;&#20132;&#23457;&#26680;</button>
          </div>
        </div>

        <section v-if="registrationStep === 0" class="step-panel is-active auth-form-block">
          <div class="split-grid stacked">
            <label class="field"><span class="field-icon">U</span><input v-model="registration.applicant" type="text" placeholder="&#30003;&#35831;&#20154;&#22995;&#21517;" /></label>
            <label class="field"><span class="field-icon">@</span><input v-model="registration.email" type="email" placeholder="&#32852;&#31995;&#37038;&#31665;" /></label>
          </div>
          <div class="role-switch stacked">
            <button class="role-card" :class="{ 'is-selected': registration.role === 'merchant' }" @click="registration.role = 'merchant'">&#21830;&#25143;&#31471;</button>
            <button class="role-card" :class="{ 'is-selected': registration.role === 'admin' }" @click="registration.role = 'admin'">&#31649;&#29702;&#31471;&#65288;&#38656;&#21518;&#21488;&#23457;&#25209;&#65289;</button>
          </div>
        </section>

        <section v-if="registrationStep === 1" class="step-panel is-active auth-form-block">
          <div class="split-grid stacked">
            <label class="field"><span class="field-icon">P</span><input v-model="registration.siteName" type="text" placeholder="&#20572;&#36710;&#22330;&#21517;&#31216;" /></label>
            <label class="field"><span class="field-icon">#</span><input v-model="registration.siteCode" type="text" placeholder="&#22330;&#25152;&#32534;&#30721; / &#32465;&#23450;&#32534;&#21495;" /></label>
          </div>
          <div class="upload-box">
            <strong>&#22330;&#25152;&#32465;&#23450;</strong>
            <p>&#21518;&#31471;&#20250;&#25226;&#27880;&#20876;&#20449;&#24687;&#20889;&#20837;&#23457;&#26680;&#27744;&#65292;&#21518;&#32493;&#21487;&#25193;&#23637;&#38468;&#20214;&#19978;&#20256;&#19982;&#23457;&#25209;&#27969;&#12290;</p>
          </div>
        </section>

        <section v-if="registrationStep === 2" class="step-panel is-active auth-form-block">
          <div class="review-card">
            <div class="review-icon"><span></span></div>
            <div>
              <h3>&#36164;&#26009;&#24050;&#23601;&#32490;</h3>
              <p>&#25552;&#20132;&#21518;&#33258;&#21160;&#36827;&#20837;&#23457;&#25209;&#27969;&#31243;&#65292;&#23457;&#26680;&#32467;&#26524;&#20250;&#36890;&#36807;&#31995;&#32479;&#36890;&#30693;&#36820;&#22238;&#12290;</p>
            </div>
          </div>
          <label class="checkbox agreement">
            <input v-model="registration.agreement" type="checkbox" />
            <span>&#25105;&#24050;&#38405;&#35835;&#24182;&#21516;&#24847; <a href="#" class="link-text">&#12298;&#20572;&#36710;&#22330;&#31649;&#29702;&#31995;&#32479;&#26381;&#21153;&#21327;&#35758;&#12299;</a></span>
          </label>
          <div class="step-actions">
            <button class="secondary-button" :disabled="registrationStep === 0" @click="registrationStep -= 1">&#19978;&#19968;&#27493;</button>
            <button class="primary-button" @click="registrationStep < 2 ? (registrationStep += 1) : handleRegister()">{{ registrationStep < 2 ? "&#19979;&#19968;&#27493;" : "&#25552;&#20132;&#23457;&#26680;" }}</button>
          </div>
        </section>
      </template>
    </section>
  </div>
    <div v-else-if="isUserPortal" class="user-layout">
    <header class="user-topbar">
      <div>
        <p class="eyebrow">ParkSphere User</p>
        <h1>??????</h1>
        <p class="lead">??????????????????????????</p>
      </div>
      <div class="user-topbar-actions">
        <div class="user-badge">
          <strong>{{ auth.user?.name }}</strong>
          <span>{{ roleLabel }}</span>
        </div>
        <button class="secondary-button" @click="logout">????</button>
      </div>
    </header>

    <section class="user-hero" v-if="dashboard.userPortal">
      <div class="user-hero-main">
        <p class="eyebrow">????</p>
        <h2>{{ dashboard.userPortal.activeParking.plateNumber }}</h2>
        <p>{{ dashboard.userPortal.activeParking.lotName }} ? {{ dashboard.userPortal.activeParking.spaceCode }} ? {{ dashboard.userPortal.activeParking.entryLabel }}</p>
        <div class="user-actions">
          <button class="primary-button" @click="handleUserAction('reserve')">????</button>
          <button class="secondary-button" @click="handleUserAction('renew')">????</button>
          <button class="secondary-button" @click="handleUserAction('invoice')">????</button>
        </div>
      </div>
      <div class="user-hero-side">
        <div><span>????</span><strong>? {{ dashboard.userPortal.activeParking.currentAmount }}</strong></div>
        <div><span>????</span><strong>{{ dashboard.userPortal.activeParking.durationLabel }}</strong></div>
        <div><span>????</span><strong>{{ dashboard.userPortal.activeParking.billingStatus }}</strong></div>
      </div>
    </section>

    <section class="user-summary-grid">
      <article class="user-summary-card" v-for="card in userSummaryCards" :key="card.label">
        <p>{{ card.label }}</p>
        <strong>{{ card.value }}</strong>
        <span>{{ card.hint }}</span>
      </article>
    </section>

    <section class="user-grid" v-if="dashboard.userPortal">
      <article class="module-card user-card">
        <div class="module-header"><div><p class="eyebrow">????</p><h3>????</h3></div></div>
        <div class="user-list">
          <div class="user-list-item" v-for="item in dashboard.userPortal.reservations" :key="item.id">
            <div><strong>{{ item.site }}</strong><p>{{ item.time }}</p></div>
            <span class="tag-pill">{{ item.status }}</span>
          </div>
        </div>
      </article>

      <article class="module-card user-card">
        <div class="module-header"><div><p class="eyebrow">????</p><h3>?????</h3></div></div>
        <div class="coupon-stack">
          <div class="coupon-card" v-for="coupon in dashboard.userPortal.coupons" :key="coupon.code">
            <div><strong>{{ coupon.title }}</strong><p>{{ coupon.code }}</p></div>
            <span>{{ coupon.validUntil }}</span>
          </div>
        </div>
      </article>

      <article class="module-card user-card span-2">
        <div class="module-header"><div><p class="eyebrow">????</p><h3>????</h3></div><button class="link-button" @click="handleUserAction('invoice')">????</button></div>
        <div class="order-table">
          <div class="order-row order-head"><span>??</span><span>???</span><span>??</span><span>??</span><span>????</span></div>
          <div class="order-row" v-for="order in dashboard.userPortal.orders" :key="order.id">
            <span>{{ order.plateNumber }}</span><span>{{ order.site }}</span><span>{{ order.duration }}</span><span>? {{ order.amount }}</span><span>{{ order.channel }}</span>
          </div>
        </div>
      </article>

      <article class="module-card user-card">
        <div class="module-header"><div><p class="eyebrow">????</p><h3>?????</h3></div><button class="link-button" @click="handleUserAction('renew')">????</button></div>
        <div class="user-meta-list">
          <div><span>????</span><strong>{{ dashboard.userPortal.membership.plan }}</strong></div>
          <div><span>????</span><strong>{{ dashboard.userPortal.membership.expiresAt }}</strong></div>
          <div><span>????</span><strong>{{ dashboard.userPortal.membership.spaceCode }}</strong></div>
        </div>
      </article>

      <article class="module-card user-card">
        <div class="module-header"><div><p class="eyebrow">????</p><h3>????</h3></div><button class="link-button" @click="handleUserAction('support')">????</button></div>
        <div class="user-list">
          <div class="user-list-item" v-for="notice in dashboard.userPortal.notices" :key="notice.id">
            <div><strong>{{ notice.title }}</strong><p>{{ notice.message }}</p></div>
            <span>{{ notice.time }}</span>
          </div>
        </div>
      </article>
    </section>
  </div>

  <div v-else class="console-layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <p class="eyebrow">ParkSphere Console</p>
        <h2>运营控制台</h2>
        <span>{{ auth.user?.name }} · {{ roleLabel }}</span>
      </div>

      <nav class="sidebar-nav">
        <button v-for="item in menus" :key="item.key" class="sidebar-item" :class="{ active: activeMenu === item.key }" @click="activeMenu = item.key">
          <strong>{{ item.label }}</strong>
          <span>{{ item.hint }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div>
          <strong>在线系统</strong>
          <span>{{ dashboard.gates[0]?.status || '数据已连接' }}</span>
        </div>
        <button class="secondary-button wide" @click="logout">退出登录</button>
      </div>
    </aside>

    <section class="console-main">
      <header class="console-header">
        <div>
          <p class="eyebrow">{{ currentMenu?.hint }}</p>
          <h1>{{ currentMenu?.label }}</h1>
        </div>
        <button type="button" class="notification-button" @click="notificationsOpen = !notificationsOpen">
          <span class="pulse-dot"></span>
          通知中心
          <div v-if="notificationsOpen" class="notification-panel">
            <article v-for="alert in dashboard.alerts" :key="alert.id">
              <strong>{{ alert.title }}</strong>
              <p>{{ alert.message }}</p>
            </article>
          </div>
        </button>
      </header>

      <template v-if="activeMenu === 'overview'">
        <div class="stats-grid">
          <article class="stat-card"><p>总车位</p><strong>{{ dashboard.overview.total }}</strong><span>固定 {{ dashboard.overview.fixed }} / 临停 {{ dashboard.overview.temporary }}</span></article>
          <article class="stat-card"><p>剩余车位</p><strong>{{ dashboard.overview.available }}</strong><span>按区域实时汇总</span></article>
          <article class="stat-card"><p>今日营收</p><strong>¥ {{ dashboard.finance?.todayRevenue ?? 0 }}</strong><span>成功率 {{ dashboard.finance?.successRate ?? 0 }}%</span></article>
        </div>
        <div class="content-grid single-top">
          <section class="module-card overview-hero">
            <div class="module-header"><div><p class="eyebrow">The Command Center</p><h3>&#23454;&#26102;&#30417;&#25511;&#19982;&#36164;&#20135;&#27010;&#35272;</h3></div><div class="mini-badges"><span>{{ dashboard.gates[0]?.status || '&#22312;&#32447;' }}</span><span>12 &#20010;&#20998;&#21306;</span></div></div>
            <div class="overview-grid">
              <article class="overview-panel trend-panel">
                <p>&#36710;&#27969;&#36235;&#21183;</p>
                <strong>1,284</strong>
                <span>&#20170;&#26085;&#32047;&#35745;&#36827;&#22330;&#36710;&#36742;&#65292;&#36739;&#26152;&#26085;&#25552;&#21319; 12%</span>
                <div class="mini-bars">
                  <span style="height: 38%"></span>
                  <span style="height: 56%"></span>
                  <span style="height: 52%"></span>
                  <span style="height: 78%"></span>
                  <span style="height: 64%"></span>
                  <span style="height: 88%"></span>
                  <span style="height: 74%"></span>
                </div>
              </article>
              <article class="overview-panel status-panel">
                <p>&#35774;&#22791;&#22312;&#32447;&#29366;&#24577;</p>
                <div class="status-list">
                  <div><strong>12/13</strong><span>&#38392;&#26426;&#22312;&#32447;</span></div>
                  <div><strong>8/8</strong><span>&#25668;&#20687;&#22836;&#22312;&#32447;</span></div>
                  <div><strong>99.2%</strong><span>&#35782;&#21035;&#25104;&#21151;&#29575;</span></div>
                </div>
              </article>
              <article class="overview-panel occupancy-panel">
                <p>&#20998;&#21306;&#21344;&#29992;</p>
                <div class="zone-list">
                  <div><span>A&#21306;</span><strong>82%</strong></div>
                  <div><span>B&#21306;</span><strong>76%</strong></div>
                  <div><span>C&#21306;</span><strong>68%</strong></div>
                  <div><span>VIP&#21306;</span><strong>54%</strong></div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </template>

      <template v-if="activeMenu === 'access'">
        <section class="module-card">
          <div class="module-header"><div><p class="eyebrow">Entry & Exit Control</p><h3>车辆识别与闸机控制</h3></div><div class="mini-badges"><span>{{ dashboard.gates[0]?.status || 'OCR 在线' }}</span><span>支持手动修正</span></div></div>
          <div class="ocr-layout">
            <div class="video-feed">
              <div class="feed-overlay"><span class="live-tag">LIVE</span><span>{{ gateForm.gateId }}</span></div>
              <div class="plate-frame"><span>{{ plateResult }}</span></div>
            </div>
            <div class="ocr-side">
              <label class="field"><span class="field-icon">车</span><input v-model="gateForm.plateNumber" type="text" placeholder="识别出的车牌号" /></label>
              <div class="split-grid">
                <label class="field"><span class="field-icon">门</span><select v-model="gateForm.gateId"><option value="gate-east-in">东门入口</option><option value="gate-east-out">东门出口</option><option value="gate-b2-in">B2 入口</option></select></label>
                <label class="field"><span class="field-icon">类</span><select v-model="gateForm.plateType"><option value="temporary">临停车</option><option value="fixed">月租车</option><option value="vip">VIP</option></select></label>
              </div>
              <div class="list-status stacked-mobile">
                <div class="list-card white"><h4>识别状态</h4><p>{{ dashboard.ocr?.provider || '本地识别引擎' }}</p><strong>{{ dashboard.ocr?.gateActionMessage || '等待识别' }}</strong></div>
                <div class="list-card dark"><h4>黑名单拦截</h4><p>命中欠费/违规车辆时禁止自动起杆。</p><button class="ghost-button light">人工干预</button></div>
              </div>
              <label class="field"><span class="field-icon">券</span><input v-model="gateForm.couponCode" type="text" placeholder="优惠券编码，例如 MALL-20" /></label>
              <div class="gate-actions stacked-mobile">
                <button class="secondary-button" @click="handleRecognize">OCR 识别</button>
                <button class="primary-button" @click="handleEntry">远程起杆入场</button>
                <button class="primary-button outline" @click="handleExit">出场计费结算</button>
              </div>
            </div>
          </div>
        </section>
      </template>

      <template v-if="activeMenu === 'billing'">
        <section class="module-card narrow-card">
          <div class="module-header"><div><p class="eyebrow">Billing Engine</p><h3>多策略计费配置</h3></div></div>
          <div class="billing-steps">
            <label class="billing-step is-active"><span>01</span><div><strong>免费时长</strong><input v-model.number="pricingForm.freeMinutes" type="number" min="0" /></div></label>
            <label class="billing-step is-active"><span>02</span><div><strong>封顶金额</strong><input v-model.number="pricingForm.capAmount" type="number" min="0" /></div></label>
            <label class="billing-step"><span>03</span><div><strong>分段 / 阶梯</strong><div class="inline-fields"><input v-model.number="pricingForm.hourlyRate" type="number" min="0" /><input v-model.number="pricingForm.stepRate" type="number" min="0" /></div></div></label>
          </div>
          <div class="qr-card"><div><p>扫码 / 无感支付</p><strong>{{ currentReport?.latestOrder || '订单待生成' }}</strong></div><div class="qr-code"></div></div>
          <button class="primary-button wide" @click="handleSavePricing">保存计费规则</button>
        </section>
      </template>

      <template v-if="activeMenu === 'spaces'">
        <section class="module-card">
          <div class="module-header"><div><p class="eyebrow">Space Optimization</p><h3>&#36710;&#20301;&#29366;&#24577;&#22320;&#22270;</h3></div><span class="status-pill">2D Live Map</span></div>
          <div class="parking-ops">
            <div class="parking-map">
              <div class="map-toolbar"><button class="chip-button" @click="handleSpaceAction('release')">&#24674;&#22797;&#31354;&#38386;</button><button class="chip-button" @click="handleSpaceAction('reserve')">VIP &#39044;&#32422;</button><button class="chip-button" @click="handleSpaceAction('monthly')">&#36716;&#26376;&#31199;&#20301;</button></div>
              <div class="space-grid">
                <button v-for="space in dashboard.map" :key="space.code" class="space space-button" :class="[space.status, { active: selectedSpaceCode === space.code }]" @click="selectedSpaceCode = space.code">{{ space.code }}</button>
              </div>
            </div>
            <aside class="space-sidecard" v-if="selectedSpace">
              <p class="eyebrow">&#21487;&#25805;&#20316;&#36710;&#20301;</p>
              <h3>{{ selectedSpace.code }}</h3>
              <div class="space-meta">
                <div><span>&#24403;&#21069;&#29366;&#24577;</span><strong>{{ selectedSpace.status }}</strong></div>
                <div><span>&#36710;&#20301;&#31867;&#22411;</span><strong>{{ selectedSpace.type }}</strong></div>
                <div><span>&#24403;&#21069;&#36523;&#20221;</span><strong>{{ roleLabel }}</strong></div>
              </div>
              <div class="space-actions">
                <button class="primary-button" @click="handleSpaceAction('occupy')">&#26631;&#35760;&#21344;&#29992;</button>
                <button class="secondary-button" @click="handleSpaceAction('release')">&#24674;&#22797;&#31354;&#38386;</button>
                <button class="secondary-button" @click="handleSpaceAction('reserve')">&#35774;&#20026;&#39044;&#32422;</button>
                <button class="secondary-button" @click="handleSpaceAction('temporary')">&#36716;&#20020;&#20572;&#36710;&#20301;</button>
              </div>
            </aside>
          </div>
        </section>
      </template>

      <template v-if="activeMenu === 'finance'">
        <section class="module-card">
          <div class="module-header"><div><p class="eyebrow">Financial Audit</p><h3>流水对账与营收趋势</h3></div><span class="status-pill">Bento Report</span></div>
          <div class="finance-grid">
            <article class="bento-panel"><p>今日营收</p><strong>¥ {{ dashboard.finance?.todayRevenue ?? 0 }}</strong><span>已完成支付 {{ dashboard.finance?.settledCount ?? 0 }} 笔</span></article>
            <article class="bento-panel tall"><p>高峰时段分析</p><svg viewBox="0 0 300 160" class="trend-chart" aria-hidden="true"><defs><linearGradient id="lineBlue" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stop-color="#9CC7FF" /><stop offset="100%" stop-color="#0071E3" /></linearGradient></defs><path d="M15 120 C 45 90, 75 98, 105 70 S 165 28, 195 54 S 255 118, 285 40" /><path class="secondary-line" d="M15 135 C 45 125, 75 118, 105 95 S 165 88, 195 98 S 255 130, 285 82" /></svg><span>{{ currentReport?.peakHint || '17:00 - 20:00 为当前车流高峰期' }}</span></article>
            <article class="bento-panel"><p>优惠抵扣</p><strong>¥ {{ dashboard.finance?.discountAmount ?? 0 }}</strong><span>商户券与减免自动在结算时抵扣</span></article>
            <article class="bento-panel"><p>最近订单</p><strong>{{ currentReport?.latestPlate || '--' }}</strong><span>{{ currentReport?.latestPayment || '暂无结算数据' }}</span></article>
          </div>
        </section>
      </template>
    </section>
  </div>

  <div v-if="toast.visible" class="toast is-visible">
    <div class="toast-icon"></div>
    <div>
      <strong>{{ toast.title }}</strong>
      <p>{{ toast.message }}</p>
    </div>
  </div>
</template>




