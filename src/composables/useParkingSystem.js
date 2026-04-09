import { computed, reactive, ref } from "vue";
import { api } from "../api";
import { consoleMenus, getSpaceStatusLabel, getSpaceTypeLabel, portalMenus, roleLabels } from "../constants/ui";

export function useParkingSystem() {
  const loginMode = ref("password");
  const authScreen = ref("login");
  const activeMenu = ref("overview");
  const registrationStep = ref(0);
  const loading = ref(false);
  const resetLoading = ref(false);
  const notificationsOpen = ref(false);
  const toast = reactive({ visible: false, title: "", message: "" });
  const auth = reactive({ token: "", user: null });
  const userDetail = reactive({ title: "", subtitle: "", items: [] });

  const menus = consoleMenus;
  const userMenus = portalMenus;

  const loginForm = reactive({
    identifier: "",
    password: "",
    phone: "",
    otp: "",
    remember: true,
    sliderVerified: false,
  });

  const resetForm = reactive({
    phone: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });

  const registration = reactive({
    applicant: "",
    email: "",
    role: "merchant",
    siteName: "",
    siteCode: "",
    agreement: false,
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

  const reservationForm = reactive({
    site: "星港商业中心 B1 层 08 号位",
    time: "今天 20:00 - 23:00",
  });

  const checkoutForm = reactive({
    couponCode: "MALL-20",
    paymentChannel: "扫码支付",
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
  const activeUserMenu = ref("overview");
  const supportPanelOpen = ref(false);
  const userActionLoading = reactive({
    reservation: false,
    checkout: false,
    support: false,
    invoice: false,
    renewal: false,
  });
  const supportForm = reactive({
    topic: "停车异常",
    contact: "",
    content: "",
  });
  const invoiceForm = reactive({
    orderId: "",
    invoiceTitle: "",
    invoiceEmail: "",
  });
  const renewalForm = reactive({
    months: 1,
    paymentChannel: "扫码支付",
    couponCode: "",
  });

  const roleLabel = computed(() => roleLabels[auth.user?.role] || "未登录");
  const isUserPortal = computed(() => auth.user?.role === "user" || dashboard.viewType === "user");
  const canEditPricing = computed(() => auth.user?.role === "admin");
  const userSummaryCards = computed(() => dashboard.userPortal?.summary || []);
  const canCheckout = computed(() => {
    const status = dashboard.userPortal?.activeParking?.billingStatus;
    return !!status && status !== "已完成支付，可离场" && status !== "当前无在场车辆";
  });
  const plateResult = computed(() => dashboard.ocr?.plateNumber || "等待识别");
  const currentReport = computed(() => dashboard.reports[0] || null);
  const currentMenu = computed(() => menus.find((item) => item.key === activeMenu.value));
  const currentUserMenu = computed(() => userMenus.find((item) => item.key === activeUserMenu.value));
  const selectedSpace = computed(() => dashboard.map.find((space) => space.code === selectedSpaceCode.value) || dashboard.map[0] || null);
  const supportTickets = computed(() => (dashboard.userPortal?.notices || []).filter((item) => item.type === "support"));
  const invoiceableOrders = computed(() => dashboard.userPortal?.orders || []);
  const selectedInvoiceOrder = computed(() => invoiceableOrders.value.find((item) => item.id === invoiceForm.orderId) || invoiceableOrders.value[0] || null);
  const latestRenewal = computed(() => dashboard.userPortal?.membership?.renewalHistory?.[0] || null);

  function notify(title, message) {
    toast.title = title;
    toast.message = message;
    toast.visible = true;
    window.setTimeout(() => {
      toast.visible = false;
    }, 3200);
  }

  function hydrateUserForms() {
    const portal = dashboard.userPortal;
    if (!portal) return;

    if (!supportForm.contact) {
      supportForm.contact = auth.user?.phone || auth.user?.email || "";
    }

    if (!invoiceForm.invoiceEmail) {
      invoiceForm.invoiceEmail = auth.user?.email || "";
    }

    if (!invoiceForm.invoiceTitle) {
      invoiceForm.invoiceTitle = `${auth.user?.name || "车主"}停车服务费`;
    }

    if (!invoiceForm.orderId || !portal.orders?.some((order) => order.id === invoiceForm.orderId)) {
      invoiceForm.orderId = portal.orders?.[0]?.id || "";
    }

    if (!renewalForm.couponCode) {
      renewalForm.couponCode = portal.coupons?.[0]?.code || "";
    }
  }

  function syncUserDetail(menuKey = activeUserMenu.value) {
    const portal = dashboard.userPortal;
    if (!portal) return;

    if (menuKey === "overview") {
      if (portal.activeParking) {
        setUserDetail("当前停车", portal.activeParking.plateNumber, [
          { label: "停车场", value: portal.activeParking.lotName },
          { label: "车位", value: portal.activeParking.spaceCode },
          { label: "入场时间", value: portal.activeParking.entryLabel },
          { label: "停车时长", value: portal.activeParking.durationLabel },
          { label: "待结算费用", value: `¥ ${portal.activeParking.currentAmount}` },
          { label: "状态", value: portal.activeParking.billingStatus },
        ]);
      }
      return;
    }

    if (menuKey === "reservations") {
      if (portal.reservations?.length) {
        openReservation(portal.reservations[0]);
      } else {
        setUserDetail("预约车位", "暂无预约记录", [{ label: "说明", value: "提交预约后会在这里展示到场信息。" }]);
      }
      return;
    }

    if (menuKey === "coupons") {
      if (portal.coupons?.length) {
        openCoupon(portal.coupons[0]);
      } else {
        setUserDetail("优惠券", "暂无可用券", [{ label: "说明", value: "商户发券和停车减免会自动同步到这里。" }]);
      }
      return;
    }

    if (menuKey === "orders") {
      if (portal.orders?.length) {
        openOrder(portal.orders[0]);
      } else {
        setUserDetail("停车订单", "暂无历史订单", [{ label: "说明", value: "完成停车缴费后会生成停车订单。" }]);
      }
      return;
    }

    if (menuKey === "membership") {
      openMembership();
    }
  }

  function selectUserMenu(menuKey) {
    activeUserMenu.value = menuKey;
    syncUserDetail(menuKey);
  }

  async function handleSendOtp() {
    if (!loginForm.phone) {
      notify("请输入手机号", "发送验证码前需要先填写手机号。");
      return;
    }
    try {
      const result = await api.sendOtp(loginForm.phone);
      loginForm.otp = result.code;
      notify("验证码已发送", `测试环境验证码：${result.code}`);
    } catch (error) {
      notify("发送失败", error.message);
    }
  }

  async function handleSendResetOtp() {
    if (!resetForm.phone) {
      notify("请输入手机号", "发送验证码前需要先填写需要找回的手机号。");
      return;
    }
    try {
      const result = await api.sendOtp(resetForm.phone);
      resetForm.otp = result.code;
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
    if (Array.isArray(result.map) && (!selectedSpaceCode.value || !result.map.some((space) => space.code === selectedSpaceCode.value))) {
      selectedSpaceCode.value = result.map[0]?.code || "";
    }
    if (result.userPortal) {
      hydrateUserForms();
      syncUserDetail();
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
      activeUserMenu.value = "overview";
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
    if (!canEditPricing.value) {
      notify("无权修改", "商户端目前只能查看计费配置，修改请使用管理端账号。");
      return;
    }
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
      notify("车位状态已更新", `${result.space.code} 已切换为 ${getSpaceStatusLabel(result.space.status)}`);
    } catch (error) {
      notify("车位操作失败", error.message);
    }
  }

  function openSupport() {
    supportPanelOpen.value = true;
    if (!supportForm.contact) {
      supportForm.contact = auth.user?.phone || auth.user?.email || "";
    }
    setUserDetail("客服工单", "支持 7 x 24 小时人工协助", [
      { label: "当前主题", value: supportForm.topic },
      { label: "联系方式", value: supportForm.contact || auth.user?.phone || auth.user?.email || "--" },
      { label: "说明", value: "提交后会生成真实工单记录，并同步到服务提醒。" },
    ]);
  }

  function openInvoiceGuide() {
    const latestOrder = dashboard.userPortal?.orders?.[0];
    setUserDetail("电子发票", latestOrder?.plateNumber || "最近订单", [
      { label: "开票对象", value: latestOrder?.site || "停车订单" },
      { label: "最近金额", value: `¥ ${latestOrder?.amount ?? 0}` },
      { label: "开票状态", value: latestOrder?.invoiceStatus || "未申请" },
      { label: "接收邮箱", value: latestOrder?.invoiceEmail || invoiceForm.invoiceEmail || "--" },
    ]);
  }

  function setUserDetail(title, subtitle, items) {
    userDetail.title = title;
    userDetail.subtitle = subtitle;
    userDetail.items = items;
  }

  function openSummary(card) {
    setUserDetail(card.label, card.value, [{ label: "说明", value: card.hint }]);
  }

  function openReservation(item) {
    setUserDetail("预约车位详情", item.site, [
      { label: "预约时段", value: item.time },
      { label: "当前状态", value: item.status },
    ]);
  }

  function openCoupon(coupon) {
    setUserDetail("优惠券详情", coupon.title, [
      { label: "券码", value: coupon.code },
      { label: "有效期", value: coupon.validUntil },
    ]);
  }

  function openOrder(order) {
    setUserDetail("停车订单详情", order.plateNumber, [
      { label: "停车场", value: order.site },
      { label: "停车时长", value: order.duration },
      { label: "实付金额", value: `¥ ${order.amount}` },
      { label: "支付方式", value: order.channel },
      { label: "发票状态", value: order.invoiceStatus || "未申请" },
      ...(order.invoiceTitle ? [{ label: "发票抬头", value: order.invoiceTitle }] : []),
      ...(order.invoiceEmail ? [{ label: "接收邮箱", value: order.invoiceEmail }] : []),
    ]);
  }

  function openNotice(notice) {
    setUserDetail(notice.type === "support" ? "客服工单" : "服务提醒", notice.title, [
      { label: "内容", value: notice.message },
      { label: "时间", value: notice.time },
      ...(notice.status ? [{ label: "处理状态", value: notice.status }] : []),
    ]);
  }

  function openMembership() {
    if (!dashboard.userPortal?.membership) return;
    setUserDetail("月租服务", dashboard.userPortal.membership.plan, [
      { label: "到期日期", value: dashboard.userPortal.membership.expiresAt },
      { label: "绑定车位", value: dashboard.userPortal.membership.spaceCode },
      { label: "月租单价", value: `¥ ${dashboard.userPortal.membership.monthlyRate || 680} / 月` },
      ...(latestRenewal.value
        ? [
            { label: "最近续费", value: `${latestRenewal.value.months} 个月 · ¥ ${latestRenewal.value.amount}` },
            { label: "续费结果", value: latestRenewal.value.status },
          ]
        : []),
    ]);
  }

  async function handleResetPassword() {
    if (!resetForm.phone || !resetForm.otp || !resetForm.newPassword || !resetForm.confirmPassword) {
      notify("请补全信息", "手机号、验证码和新密码都需要填写。");
      return;
    }

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      notify("两次密码不一致", "请重新确认新密码。");
      return;
    }

    resetLoading.value = true;
    try {
      await api.resetPassword({
        phone: resetForm.phone,
        otp: resetForm.otp,
        newPassword: resetForm.newPassword,
      });
      notify("密码已重置", "请返回登录页使用新密码重新登录。");
      resetForm.otp = "";
      resetForm.newPassword = "";
      resetForm.confirmPassword = "";
      authScreen.value = "login";
      loginMode.value = "password";
    } catch (error) {
      notify("重置失败", error.message);
    } finally {
      resetLoading.value = false;
    }
  }

  async function handleCreateReservation() {
    userActionLoading.reservation = true;
    try {
      const result = await api.createUserReservation(auth.token, reservationForm);
      dashboard.userPortal = result.userPortal;
      hydrateUserForms();
      activeUserMenu.value = "reservations";
      openReservation(result.reservation);
      notify("预约成功", `${result.reservation.site} 已加入你的预约列表`);
    } catch (error) {
      notify("预约失败", error.message);
    } finally {
      userActionLoading.reservation = false;
    }
  }

  async function handleUserCheckout() {
    if (!canCheckout.value) {
      notify("当前无待缴订单", "请先确认车辆已入场并存在待支付费用。");
      return;
    }
    userActionLoading.checkout = true;
    try {
      const result = await api.checkoutUserParking(auth.token, checkoutForm);
      dashboard.userPortal = result.userPortal;
      hydrateUserForms();
      activeUserMenu.value = "orders";
      setUserDetail("离场缴费完成", result.payment.plateNumber, [
        { label: "支付金额", value: `¥ ${result.bill.finalAmount}` },
        { label: "支付渠道", value: result.payment.channel },
        { label: "停车时长", value: dashboard.userPortal.activeParking.durationLabel },
        { label: "当前状态", value: dashboard.userPortal.activeParking.billingStatus },
      ]);
      notify("缴费成功", `已支付 ¥ ${result.bill.finalAmount}，现在可以离场`);
    } catch (error) {
      notify("缴费失败", error.message);
    } finally {
      userActionLoading.checkout = false;
    }
  }

  async function handleCreateSupportTicket() {
    userActionLoading.support = true;
    try {
      const result = await api.createSupportTicket(auth.token, supportForm);
      dashboard.userPortal = result.userPortal;
      hydrateUserForms();
      supportPanelOpen.value = false;
      openNotice(result.ticket);
      notify("工单已创建", "客服请求已提交，处理进度会同步到服务提醒。");
    } catch (error) {
      notify("提交失败", error.message);
    } finally {
      userActionLoading.support = false;
    }
  }

  async function handleRequestInvoice() {
    userActionLoading.invoice = true;
    try {
      const result = await api.requestInvoice(auth.token, invoiceForm);
      dashboard.userPortal = result.userPortal;
      hydrateUserForms();
      invoiceForm.orderId = result.order.id;
      openOrder(result.order);
      notify("发票申请已提交", `订单 ${result.order.id} 的电子发票正在处理。`);
    } catch (error) {
      notify("开票失败", error.message);
    } finally {
      userActionLoading.invoice = false;
    }
  }

  async function handleRenewMembership() {
    userActionLoading.renewal = true;
    try {
      const result = await api.renewMembership(auth.token, renewalForm);
      dashboard.userPortal = result.userPortal;
      hydrateUserForms();
      openMembership();
      notify("月租续费成功", `已续费 ${result.renewal.months} 个月，到期日更新为 ${result.renewal.expiresAt}。`);
    } catch (error) {
      notify("续费失败", error.message);
    } finally {
      userActionLoading.renewal = false;
    }
  }

  function logout() {
    auth.token = "";
    auth.user = null;
    notificationsOpen.value = false;
    supportPanelOpen.value = false;
    supportForm.contact = "";
    supportForm.content = "";
    invoiceForm.orderId = "";
    invoiceForm.invoiceEmail = "";
    invoiceForm.invoiceTitle = "";
    renewalForm.months = 1;
    renewalForm.paymentChannel = "扫码支付";
    renewalForm.couponCode = "";
    loginForm.sliderVerified = false;
    loginMode.value = "password";
    authScreen.value = "login";
  }

  return {
    activeMenu,
    activeUserMenu,
    auth,
    authScreen,
    canCheckout,
    canEditPricing,
    checkoutForm,
    currentMenu,
    currentReport,
    currentUserMenu,
    dashboard,
    gateForm,
    getSpaceStatusLabel,
    getSpaceTypeLabel,
    handleCreateReservation,
    handleCreateSupportTicket,
    handleEntry,
    handleExit,
    handleLogin,
    handleRecognize,
    handleRegister,
    handleRenewMembership,
    handleRequestInvoice,
    handleResetPassword,
    handleSavePricing,
    handleSendOtp,
    handleSendResetOtp,
    handleSpaceAction,
    handleUserCheckout,
    invoiceForm,
    invoiceableOrders,
    isUserPortal,
    latestRenewal,
    loading,
    loginForm,
    loginMode,
    logout,
    menus,
    notificationsOpen,
    openCoupon,
    openInvoiceGuide,
    openMembership,
    openNotice,
    openOrder,
    openReservation,
    openSummary,
    openSupport,
    plateResult,
    pricingForm,
    registration,
    registrationStep,
    renewalForm,
    reservationForm,
    resetForm,
    resetLoading,
    roleLabel,
    selectedInvoiceOrder,
    selectedSpace,
    selectedSpaceCode,
    selectUserMenu,
    syncUserDetail,
    supportForm,
    supportPanelOpen,
    supportTickets,
    toast,
    userActionLoading,
    userDetail,
    userMenus,
    userSummaryCards,
  };
}
