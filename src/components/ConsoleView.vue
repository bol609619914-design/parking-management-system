<script setup>
defineProps({
  app: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div class="console-layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <p class="eyebrow">ParkSphere Console</p>
        <h2>运营控制台</h2>
        <span>{{ app.auth.user?.name }} · {{ app.roleLabel }}</span>
      </div>

      <nav class="sidebar-nav">
        <button v-for="item in app.menus" :key="item.key" class="sidebar-item" :class="{ active: app.activeMenu === item.key }" @click="app.activeMenu = item.key">
          <strong>{{ item.label }}</strong>
          <span>{{ item.hint }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div>
          <strong>在线系统</strong>
          <span>{{ app.dashboard.gates[0]?.status || "数据已连接" }}</span>
        </div>
        <button class="secondary-button wide" @click="app.logout">退出登录</button>
      </div>
    </aside>

    <section class="console-main">
      <header class="console-header">
        <div>
          <p class="eyebrow">{{ app.currentMenu?.hint }}</p>
          <h1>{{ app.currentMenu?.label }}</h1>
        </div>
        <button type="button" class="notification-button" @click="app.notificationsOpen = !app.notificationsOpen">
          <span class="pulse-dot"></span>
          通知中心
          <div v-if="app.notificationsOpen" class="notification-panel">
            <article v-for="alert in app.dashboard.alerts" :key="alert.id">
              <strong>{{ alert.title }}</strong>
              <p>{{ alert.message }}</p>
            </article>
          </div>
        </button>
      </header>

      <template v-if="app.activeMenu === 'overview'">
        <div class="stats-grid">
          <article class="stat-card"><p>总车位</p><strong>{{ app.dashboard.overview.total }}</strong><span>固定 {{ app.dashboard.overview.fixed }} / 临停 {{ app.dashboard.overview.temporary }}</span></article>
          <article class="stat-card"><p>剩余车位</p><strong>{{ app.dashboard.overview.available }}</strong><span>按区域实时汇总</span></article>
          <article class="stat-card"><p>今日营收</p><strong>¥ {{ app.dashboard.finance?.todayRevenue ?? 0 }}</strong><span>成功率 {{ app.dashboard.finance?.successRate ?? 0 }}%</span></article>
        </div>
        <div class="content-grid single-top">
          <section class="module-card overview-hero">
            <div class="module-header">
              <div>
                <p class="eyebrow">The Command Center</p>
                <h3>实时监控与资产概览</h3>
              </div>
              <div class="mini-badges"><span>{{ app.dashboard.gates[0]?.status || "在线" }}</span><span>12 个分区</span></div>
            </div>
            <div class="overview-grid">
              <article class="overview-panel trend-panel">
                <p>车流趋势</p>
                <strong>1,284</strong>
                <span>今日累计进场车辆，较昨日提升 12%</span>
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
                <p>设备在线状态</p>
                <div class="status-list">
                  <div><strong>12/13</strong><span>闸机在线</span></div>
                  <div><strong>8/8</strong><span>摄像头在线</span></div>
                  <div><strong>99.2%</strong><span>识别成功率</span></div>
                </div>
              </article>
              <article class="overview-panel occupancy-panel">
                <p>分区占用</p>
                <div class="zone-list">
                  <div><span>A区</span><strong>82%</strong></div>
                  <div><span>B区</span><strong>76%</strong></div>
                  <div><span>C区</span><strong>68%</strong></div>
                  <div><span>VIP区</span><strong>54%</strong></div>
                </div>
              </article>
            </div>
          </section>
        </div>
      </template>

      <template v-if="app.activeMenu === 'access'">
        <section class="module-card">
          <div class="module-header"><div><p class="eyebrow">Entry & Exit Control</p><h3>车辆识别与闸机控制</h3></div><div class="mini-badges"><span>{{ app.dashboard.gates[0]?.status || "OCR 在线" }}</span><span>支持手动修正</span></div></div>
          <div class="ocr-layout">
            <div class="video-feed">
              <div class="feed-overlay"><span class="live-tag">LIVE</span><span>{{ app.gateForm.gateId }}</span></div>
              <div class="plate-frame"><span>{{ app.plateResult }}</span></div>
            </div>
            <div class="ocr-side">
              <label class="field"><span class="field-icon">车</span><input v-model="app.gateForm.plateNumber" type="text" placeholder="识别出的车牌号" /></label>
              <div class="split-grid">
                <label class="field"><span class="field-icon">门</span><select v-model="app.gateForm.gateId"><option value="gate-east-in">东门入口</option><option value="gate-east-out">东门出口</option><option value="gate-b2-in">B2 入口</option></select></label>
                <label class="field"><span class="field-icon">类</span><select v-model="app.gateForm.plateType"><option value="temporary">临停车</option><option value="fixed">月租车</option><option value="vip">VIP</option></select></label>
              </div>
              <div class="list-status stacked-mobile">
                <div class="list-card white"><h4>识别状态</h4><p>{{ app.dashboard.ocr?.provider || "本地识别引擎" }}</p><strong>{{ app.dashboard.ocr?.gateActionMessage || "等待识别" }}</strong></div>
                <div class="list-card dark"><h4>黑名单拦截</h4><p>命中欠费/违规车辆时禁止自动起杆。</p><button class="ghost-button light">人工干预</button></div>
              </div>
              <label class="field"><span class="field-icon">券</span><input v-model="app.gateForm.couponCode" type="text" placeholder="优惠券编码，例如 MALL-20" /></label>
              <div class="gate-actions stacked-mobile">
                <button class="secondary-button" @click="app.handleRecognize">OCR 识别</button>
                <button class="primary-button" @click="app.handleEntry">远程起杆入场</button>
                <button class="primary-button outline" @click="app.handleExit">出场计费结算</button>
              </div>
            </div>
          </div>
        </section>
      </template>

      <template v-if="app.activeMenu === 'billing'">
        <section class="module-card narrow-card">
          <div class="module-header"><div><p class="eyebrow">Billing Engine</p><h3>多策略计费配置</h3></div></div>
          <div class="billing-steps">
            <label class="billing-step is-active"><span>01</span><div><strong>免费时长</strong><input v-model.number="app.pricingForm.freeMinutes" :disabled="!app.canEditPricing" type="number" min="0" /></div></label>
            <label class="billing-step is-active"><span>02</span><div><strong>封顶金额</strong><input v-model.number="app.pricingForm.capAmount" :disabled="!app.canEditPricing" type="number" min="0" /></div></label>
            <label class="billing-step"><span>03</span><div><strong>分段 / 阶梯</strong><div class="inline-fields"><input v-model.number="app.pricingForm.hourlyRate" :disabled="!app.canEditPricing" type="number" min="0" /><input v-model.number="app.pricingForm.stepRate" :disabled="!app.canEditPricing" type="number" min="0" /></div></div></label>
          </div>
          <div class="qr-card"><div><p>扫码 / 无感支付</p><strong>{{ app.currentReport?.latestOrder || "订单待生成" }}</strong></div><div class="qr-code"></div></div>
          <div v-if="!app.canEditPricing" class="upload-box">
            <strong>当前为只读模式</strong>
            <p>商户端可以查看计费规则和支付方式，修改请使用管理端账号登录。</p>
          </div>
          <button v-if="app.canEditPricing" class="primary-button wide" @click="app.handleSavePricing">保存计费规则</button>
        </section>
      </template>

      <template v-if="app.activeMenu === 'spaces'">
        <section class="module-card">
          <div class="module-header"><div><p class="eyebrow">Space Optimization</p><h3>车位状态地图</h3></div><span class="status-pill">2D Live Map</span></div>
          <div class="parking-ops">
            <div class="parking-map">
              <div class="map-toolbar"><button class="chip-button" @click="app.handleSpaceAction('release')">恢复空闲</button><button class="chip-button" @click="app.handleSpaceAction('reserve')">VIP 预约</button><button class="chip-button" @click="app.handleSpaceAction('monthly')">转月租位</button></div>
              <div class="space-grid">
                <button
                  v-for="space in app.dashboard.map"
                  :key="space.code"
                  class="space space-button"
                  :class="[space.status, { active: app.selectedSpaceCode === space.code }]"
                  @click="app.selectedSpaceCode = space.code"
                >
                  {{ space.code }}
                </button>
              </div>
            </div>
            <aside class="space-sidecard" v-if="app.selectedSpace">
              <p class="eyebrow">可操作车位</p>
              <h3>{{ app.selectedSpace.code }}</h3>
              <div class="space-meta">
                <div><span>当前状态</span><strong>{{ app.getSpaceStatusLabel(app.selectedSpace.status) }}</strong></div>
                <div><span>车位类型</span><strong>{{ app.getSpaceTypeLabel(app.selectedSpace.type) }}</strong></div>
                <div><span>当前身份</span><strong>{{ app.roleLabel }}</strong></div>
              </div>
              <div class="space-actions">
                <button class="primary-button" @click="app.handleSpaceAction('occupy')">标记占用</button>
                <button class="secondary-button" @click="app.handleSpaceAction('release')">恢复空闲</button>
                <button class="secondary-button" @click="app.handleSpaceAction('reserve')">设为预约</button>
                <button class="secondary-button" @click="app.handleSpaceAction('temporary')">转临停车位</button>
              </div>
            </aside>
          </div>
        </section>
      </template>

      <template v-if="app.activeMenu === 'finance'">
        <section class="module-card">
          <div class="module-header"><div><p class="eyebrow">Financial Audit</p><h3>流水对账与营收趋势</h3></div><span class="status-pill">Bento Report</span></div>
          <div class="finance-grid">
            <article class="bento-panel"><p>今日营收</p><strong>¥ {{ app.dashboard.finance?.todayRevenue ?? 0 }}</strong><span>已完成支付 {{ app.dashboard.finance?.settledCount ?? 0 }} 笔</span></article>
            <article class="bento-panel tall"><p>高峰时段分析</p><svg viewBox="0 0 300 160" class="trend-chart" aria-hidden="true"><defs><linearGradient id="lineBlue" x1="0%" x2="100%" y1="0%" y2="0%"><stop offset="0%" stop-color="#9CC7FF" /><stop offset="100%" stop-color="#0071E3" /></linearGradient></defs><path d="M15 120 C 45 90, 75 98, 105 70 S 165 28, 195 54 S 255 118, 285 40" /><path class="secondary-line" d="M15 135 C 45 125, 75 118, 105 95 S 165 88, 195 98 S 255 130, 285 82" /></svg><span>{{ app.currentReport?.peakHint || "17:00 - 20:00 为当前车流高峰期" }}</span></article>
            <article class="bento-panel"><p>优惠抵扣</p><strong>¥ {{ app.dashboard.finance?.discountAmount ?? 0 }}</strong><span>商户券与减免自动在结算时抵扣</span></article>
            <article class="bento-panel"><p>最近订单</p><strong>{{ app.currentReport?.latestPlate || "--" }}</strong><span>{{ app.currentReport?.latestPayment || "暂无结算数据" }}</span></article>
          </div>
        </section>
      </template>
    </section>
  </div>
</template>
