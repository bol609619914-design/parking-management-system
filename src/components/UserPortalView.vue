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
        <p class="eyebrow">ParkSphere User</p>
        <h2>车主服务中心</h2>
        <span>{{ app.auth.user?.name }} · {{ app.roleLabel }}</span>
      </div>

      <nav class="sidebar-nav">
        <button
          v-for="item in app.userMenus"
          :key="item.key"
          class="sidebar-item"
          :class="{ active: app.activeUserMenu === item.key }"
          @click="app.selectUserMenu(item.key)"
        >
          <strong>{{ item.label }}</strong>
          <span>{{ item.hint }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div>
          <strong>当前车辆</strong>
          <span>{{ app.dashboard.userPortal?.activeParking?.plateNumber || "暂无在场车辆" }}</span>
        </div>
        <button class="secondary-button wide" @click="app.logout">退出登录</button>
      </div>
    </aside>

    <section class="console-main" v-if="app.dashboard.userPortal">
      <header class="console-header">
        <div>
          <p class="eyebrow">{{ app.currentUserMenu?.hint }}</p>
          <h1>{{ app.currentUserMenu?.label }}</h1>
        </div>
        <button class="secondary-button" @click="app.openSupport">联系客服</button>
      </header>

      <section v-if="app.supportPanelOpen" class="support-panel">
        <div class="module-header">
          <div>
            <p class="eyebrow">服务工单</p>
            <h3>提交客服请求</h3>
          </div>
          <button class="link-button" @click="app.supportPanelOpen = false">收起</button>
        </div>
        <div class="support-layout">
          <div class="support-form">
            <label class="field">
              <span class="field-icon">题</span>
              <input v-model="app.supportForm.topic" type="text" placeholder="例如：车辆无法出场" />
            </label>
            <label class="field">
              <span class="field-icon">联</span>
              <input v-model="app.supportForm.contact" type="text" placeholder="手机号或邮箱" />
            </label>
            <label class="textarea-field">
              <span class="field-icon">述</span>
              <textarea v-model="app.supportForm.content" rows="4" placeholder="描述当前问题、位置和希望处理方式"></textarea>
            </label>
            <button class="primary-button" :disabled="app.userActionLoading.support" @click="app.handleCreateSupportTicket">
              {{ app.userActionLoading.support ? "提交中..." : "提交工单" }}
            </button>
          </div>

          <div class="support-ticket-list">
            <article class="support-ticket" v-for="ticket in app.supportTickets.slice(0, 3)" :key="ticket.id" @click="app.openNotice(ticket)">
              <strong>{{ ticket.title }}</strong>
              <p>{{ ticket.message }}</p>
              <span>{{ ticket.status || ticket.time }}</span>
            </article>
            <p v-if="!app.supportTickets.length" class="empty-hint">提交后会在这里保留最近的客服工单。</p>
          </div>
        </div>
      </section>

      <template v-if="app.activeUserMenu === 'overview'">
        <section class="user-hero">
          <div class="user-hero-main">
            <p class="eyebrow">当前停车</p>
            <h2>{{ app.dashboard.userPortal.activeParking.plateNumber }}</h2>
            <p>{{ app.dashboard.userPortal.activeParking.lotName }} · {{ app.dashboard.userPortal.activeParking.spaceCode }} · {{ app.dashboard.userPortal.activeParking.entryLabel }}</p>
            <div class="user-actions">
              <button class="primary-button" @click="app.selectUserMenu('reservations')">预约车位</button>
              <button class="secondary-button" @click="app.selectUserMenu('orders')">结束离场缴费</button>
              <button class="secondary-button" @click="app.selectUserMenu('membership')">月租续费</button>
            </div>
          </div>
          <div class="user-hero-side">
            <div><span>当前费用</span><strong>¥ {{ app.dashboard.userPortal.activeParking.currentAmount }}</strong></div>
            <div><span>停车时长</span><strong>{{ app.dashboard.userPortal.activeParking.durationLabel }}</strong></div>
            <div><span>支付状态</span><strong>{{ app.dashboard.userPortal.activeParking.billingStatus }}</strong></div>
          </div>
        </section>

        <section class="user-summary-grid">
          <article class="user-summary-card interactive-card" v-for="card in app.userSummaryCards" :key="card.label" @click="app.openSummary(card)">
            <p>{{ card.label }}</p>
            <strong>{{ card.value }}</strong>
            <span>{{ card.hint }}</span>
          </article>
        </section>

        <section class="user-grid">
          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">快速操作</p><h3>预约车位</h3></div></div>
            <div class="user-form">
              <label class="field"><span class="field-icon">位</span><input v-model="app.reservationForm.site" type="text" placeholder="输入预约车位或停车场位置" /></label>
              <label class="field"><span class="field-icon">时</span><input v-model="app.reservationForm.time" type="text" placeholder="输入预约时段" /></label>
              <button class="primary-button wide" :disabled="app.userActionLoading.reservation" @click="app.handleCreateReservation">
                {{ app.userActionLoading.reservation ? "提交中..." : "提交预约" }}
              </button>
            </div>
          </article>

          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">快速操作</p><h3>离场缴费</h3></div></div>
            <div class="user-form">
              <label class="field"><span class="field-icon">券</span><input v-model="app.checkoutForm.couponCode" type="text" placeholder="输入优惠券编码" /></label>
              <label class="field"><span class="field-icon">付</span><select v-model="app.checkoutForm.paymentChannel"><option value="扫码支付">扫码支付</option><option value="无感支付">无感支付</option></select></label>
              <button class="primary-button wide" :disabled="app.userActionLoading.checkout || !app.canCheckout" @click="app.handleUserCheckout">
                {{ app.userActionLoading.checkout ? "结算中..." : app.canCheckout ? "完成缴费并离场" : "当前无待缴订单" }}
              </button>
            </div>
          </article>

          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">消息中心</p><h3>服务提醒</h3></div></div>
            <div class="user-list">
              <div class="user-list-item interactive-row" v-for="notice in app.dashboard.userPortal.notices" :key="notice.id" @click="app.openNotice(notice)">
                <div><strong>{{ notice.title }}</strong><p>{{ notice.message }}</p></div>
                <span>{{ notice.time }}</span>
              </div>
            </div>
          </article>

          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">预约车位</p><h3>最近预约</h3></div></div>
            <div class="user-list">
              <div class="user-list-item interactive-row" v-for="item in app.dashboard.userPortal.reservations" :key="item.id" @click="app.openReservation(item)">
                <div><strong>{{ item.site }}</strong><p>{{ item.time }}</p></div>
                <span class="tag-pill">{{ item.status }}</span>
              </div>
            </div>
          </article>

          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">详情面板</p><h3>{{ app.userDetail.title }}</h3></div></div>
            <div class="user-detail-card">
              <strong>{{ app.userDetail.subtitle }}</strong>
              <div class="user-meta-list">
                <div v-for="item in app.userDetail.items" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-if="app.activeUserMenu === 'reservations'">
        <section class="user-grid">
          <article class="module-card user-card span-2">
            <div class="module-header"><div><p class="eyebrow">预约车位</p><h3>预约记录</h3></div><button class="link-button" @click="app.syncUserDetail('reservations')">查看首条详情</button></div>
            <div class="user-form compact">
              <label class="field"><span class="field-icon">位</span><input v-model="app.reservationForm.site" type="text" placeholder="输入预约车位或停车场位置" /></label>
              <label class="field"><span class="field-icon">时</span><input v-model="app.reservationForm.time" type="text" placeholder="输入预约时段" /></label>
              <button class="primary-button" :disabled="app.userActionLoading.reservation" @click="app.handleCreateReservation">
                {{ app.userActionLoading.reservation ? "提交中..." : "立即预约" }}
              </button>
            </div>
            <div class="user-list">
              <div class="user-list-item interactive-row" v-for="item in app.dashboard.userPortal.reservations" :key="item.id" @click="app.openReservation(item)">
                <div><strong>{{ item.site }}</strong><p>{{ item.time }}</p></div>
                <span class="tag-pill">{{ item.status }}</span>
              </div>
            </div>
          </article>

          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">预约详情</p><h3>{{ app.userDetail.title }}</h3></div></div>
            <div class="user-detail-card">
              <strong>{{ app.userDetail.subtitle }}</strong>
              <div class="user-meta-list">
                <div v-for="item in app.userDetail.items" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-if="app.activeUserMenu === 'coupons'">
        <section class="user-grid">
          <article class="module-card user-card span-2">
            <div class="module-header"><div><p class="eyebrow">优惠权益</p><h3>可用优惠券</h3></div></div>
            <div class="coupon-stack">
              <div class="coupon-card interactive-row" v-for="coupon in app.dashboard.userPortal.coupons" :key="coupon.code" @click="app.openCoupon(coupon)">
                <div><strong>{{ coupon.title }}</strong><p>{{ coupon.code }}</p></div>
                <span>{{ coupon.validUntil }}</span>
              </div>
            </div>
          </article>

          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">优惠券详情</p><h3>{{ app.userDetail.title }}</h3></div></div>
            <div class="user-detail-card">
              <strong>{{ app.userDetail.subtitle }}</strong>
              <div class="user-meta-list">
                <div v-for="item in app.userDetail.items" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-if="app.activeUserMenu === 'orders'">
        <section class="user-grid">
          <article class="module-card user-card span-2">
            <div class="module-header"><div><p class="eyebrow">停车记录</p><h3>最近订单</h3></div><button class="link-button" @click="app.openInvoiceGuide">查看开票详情</button></div>
            <div class="user-form compact">
              <label class="field"><span class="field-icon">券</span><input v-model="app.checkoutForm.couponCode" type="text" placeholder="输入优惠券编码" /></label>
              <label class="field"><span class="field-icon">付</span><select v-model="app.checkoutForm.paymentChannel"><option value="扫码支付">扫码支付</option><option value="无感支付">无感支付</option></select></label>
              <button class="primary-button" :disabled="app.userActionLoading.checkout || !app.canCheckout" @click="app.handleUserCheckout">
                {{ app.userActionLoading.checkout ? "结算中..." : app.canCheckout ? "结束停车并缴费" : "当前无待缴订单" }}
              </button>
            </div>
            <div class="invoice-form-grid">
              <label class="field">
                <span class="field-icon">单</span>
                <select v-model="app.invoiceForm.orderId">
                  <option v-for="order in app.invoiceableOrders" :key="order.id" :value="order.id">{{ order.plateNumber }} · {{ order.site }}</option>
                </select>
              </label>
              <label class="field">
                <span class="field-icon">抬</span>
                <input v-model="app.invoiceForm.invoiceTitle" type="text" placeholder="发票抬头" />
              </label>
              <label class="field">
                <span class="field-icon">@</span>
                <input v-model="app.invoiceForm.invoiceEmail" type="email" placeholder="接收邮箱" />
              </label>
              <button
                class="secondary-button"
                :disabled="app.userActionLoading.invoice || !app.invoiceableOrders.length || app.selectedInvoiceOrder?.invoiceStatus === '已开票'"
                @click="app.handleRequestInvoice"
              >
                {{ app.userActionLoading.invoice ? "申请中..." : app.selectedInvoiceOrder?.invoiceStatus === "已开票" ? "订单已开票" : "申请电子发票" }}
              </button>
            </div>
            <div class="order-table">
              <div class="order-row order-head"><span>车牌</span><span>停车场</span><span>时长</span><span>金额</span><span>支付方式</span></div>
              <div class="order-row interactive-row" v-for="order in app.dashboard.userPortal.orders" :key="order.id" @click="app.openOrder(order)">
                <span>{{ order.plateNumber }}</span>
                <span>{{ order.site }}</span>
                <span>{{ order.duration }}</span>
                <span>¥ {{ order.amount }}</span>
                <span>{{ order.invoiceStatus && order.invoiceStatus !== "未申请" ? `${order.channel} · ${order.invoiceStatus}` : order.channel }}</span>
              </div>
            </div>
          </article>

          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">订单详情</p><h3>{{ app.userDetail.title }}</h3></div></div>
            <div class="user-detail-card">
              <strong>{{ app.userDetail.subtitle }}</strong>
              <div class="user-meta-list">
                <div v-for="item in app.userDetail.items" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>

      <template v-if="app.activeUserMenu === 'membership'">
        <section class="user-grid">
          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">月租服务</p><h3>套餐信息</h3></div><button class="link-button" @click="app.openMembership">刷新详情</button></div>
            <div class="user-meta-list interactive-card" @click="app.openMembership()">
              <div><span>套餐名称</span><strong>{{ app.dashboard.userPortal.membership.plan }}</strong></div>
              <div><span>到期日期</span><strong>{{ app.dashboard.userPortal.membership.expiresAt }}</strong></div>
              <div><span>绑定车位</span><strong>{{ app.dashboard.userPortal.membership.spaceCode }}</strong></div>
            </div>
            <div class="renewal-form-grid">
              <label class="field">
                <span class="field-icon">月</span>
                <select v-model.number="app.renewalForm.months">
                  <option :value="1">续费 1 个月</option>
                  <option :value="3">续费 3 个月</option>
                  <option :value="6">续费 6 个月</option>
                  <option :value="12">续费 12 个月</option>
                </select>
              </label>
              <label class="field">
                <span class="field-icon">付</span>
                <select v-model="app.renewalForm.paymentChannel">
                  <option value="扫码支付">扫码支付</option>
                  <option value="无感支付">无感支付</option>
                </select>
              </label>
              <label class="field">
                <span class="field-icon">券</span>
                <input v-model="app.renewalForm.couponCode" type="text" placeholder="可选优惠券编码" />
              </label>
              <button class="primary-button" :disabled="app.userActionLoading.renewal" @click="app.handleRenewMembership">
                {{ app.userActionLoading.renewal ? "续费中..." : "立即续费" }}
              </button>
            </div>
          </article>

          <article class="module-card user-card">
            <div class="module-header"><div><p class="eyebrow">优惠权益</p><h3>续费可用券</h3></div></div>
            <div class="coupon-stack">
              <div class="coupon-card interactive-row" v-for="coupon in app.dashboard.userPortal.coupons" :key="coupon.code" @click="app.openCoupon(coupon)">
                <div><strong>{{ coupon.title }}</strong><p>{{ coupon.code }}</p></div>
                <span>{{ coupon.validUntil }}</span>
              </div>
            </div>
          </article>

          <article class="module-card user-card span-2">
            <div class="module-header"><div><p class="eyebrow">服务详情</p><h3>{{ app.userDetail.title }}</h3></div></div>
            <div class="user-detail-card">
              <strong>{{ app.userDetail.subtitle }}</strong>
              <div class="user-meta-list">
                <div v-for="item in app.userDetail.items" :key="item.label">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
              <div v-if="app.latestRenewal" class="renewal-history">
                <h4>最近续费记录</h4>
                <div class="user-meta-list">
                  <div>
                    <span>续费周期</span>
                    <strong>{{ app.latestRenewal.months }} 个月</strong>
                  </div>
                  <div>
                    <span>支付金额</span>
                    <strong>¥ {{ app.latestRenewal.amount }}</strong>
                  </div>
                  <div>
                    <span>新的到期日</span>
                    <strong>{{ app.latestRenewal.expiresAt }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </section>
      </template>
    </section>
  </div>
</template>
