<script setup>
defineProps({
  app: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div class="auth-layout">
    <section class="auth-panel">
      <p class="auth-kicker">停车场管理系统</p>

      <template v-if="app.authScreen === 'login'">
        <div class="card-tabs compact">
          <button class="card-tab" :class="{ 'is-active': app.loginMode === 'password' }" @click="app.loginMode = 'password'">账号登录</button>
          <button class="card-tab" :class="{ 'is-active': app.loginMode === 'otp' }" @click="app.loginMode = 'otp'">手机快捷登录</button>
        </div>

        <div class="login-form auth-form-block">
          <label class="field">
            <span class="field-icon">@</span>
            <input v-if="app.loginMode === 'password'" v-model="app.loginForm.identifier" type="text" placeholder="邮箱 / 用户名" />
            <input v-else v-model="app.loginForm.phone" type="tel" placeholder="手机号" />
          </label>

          <label class="field" v-if="app.loginMode === 'password'">
            <span class="field-icon">*</span>
            <input v-model="app.loginForm.password" type="password" placeholder="登录密码" />
          </label>

          <div class="otp-row" v-else>
            <label class="field">
              <span class="field-icon">#</span>
              <input v-model="app.loginForm.otp" type="text" placeholder="短信验证码" />
            </label>
            <button class="ghost-button" type="button" @click="app.handleSendOtp">发送验证码</button>
          </div>

          <div class="slider-verify" :class="{ verified: app.loginForm.sliderVerified }" @click="app.loginForm.sliderVerified = !app.loginForm.sliderVerified">
            <div class="slider-track">
              <div class="slider-fill"></div>
              <div class="slider-thumb"></div>
              <span>{{ app.loginForm.sliderVerified ? "已通过安全验证" : "点击模拟滑块验证" }}</span>
            </div>
          </div>

          <div class="form-row">
            <label class="checkbox">
              <input v-model="app.loginForm.remember" type="checkbox" />
              <span>记住我</span>
            </label>
            <div class="auth-links">
              <button type="button" class="link-button" @click="app.authScreen = 'reset'">忘记密码？</button>
              <button type="button" class="link-button" @click="app.authScreen = 'register'">注册</button>
            </div>
          </div>

          <button class="primary-button wide" :disabled="app.loading" @click="app.handleLogin">{{ app.loading ? "登录中..." : "进入控制台" }}</button>
        </div>
      </template>

      <template v-else-if="app.authScreen === 'register'">
        <div class="auth-links auth-links-top">
          <button type="button" class="link-button" @click="app.authScreen = 'login'">返回登录</button>
        </div>

        <div class="step-progress auth-form-block">
          <div class="step-line"><span class="step-fill" :style="{ width: `${(app.registrationStep + 1) * 33.33}%` }"></span></div>
          <div class="step-labels">
            <button class="step-label" :class="{ 'is-current': app.registrationStep === 0 }" @click="app.registrationStep = 0">基本信息</button>
            <button class="step-label" :class="{ 'is-current': app.registrationStep === 1 }" @click="app.registrationStep = 1">场所绑定</button>
            <button class="step-label" :class="{ 'is-current': app.registrationStep === 2 }" @click="app.registrationStep = 2">提交审核</button>
          </div>
        </div>

        <section v-if="app.registrationStep === 0" class="step-panel is-active auth-form-block">
          <div class="split-grid stacked">
            <label class="field"><span class="field-icon">U</span><input v-model="app.registration.applicant" type="text" placeholder="申请人姓名" /></label>
            <label class="field"><span class="field-icon">@</span><input v-model="app.registration.email" type="email" placeholder="联系邮箱" /></label>
          </div>
          <div class="role-switch stacked">
            <button class="role-card" :class="{ 'is-selected': app.registration.role === 'merchant' }" @click="app.registration.role = 'merchant'">商户端</button>
            <button class="role-card" :class="{ 'is-selected': app.registration.role === 'admin' }" @click="app.registration.role = 'admin'">管理端（需后台审批）</button>
          </div>
        </section>

        <section v-if="app.registrationStep === 1" class="step-panel is-active auth-form-block">
          <div class="split-grid stacked">
            <label class="field"><span class="field-icon">P</span><input v-model="app.registration.siteName" type="text" placeholder="停车场名称" /></label>
            <label class="field"><span class="field-icon">#</span><input v-model="app.registration.siteCode" type="text" placeholder="场所编码 / 绑定编号" /></label>
          </div>
          <div class="upload-box">
            <strong>场所绑定</strong>
            <p>后台会将注册信息写入审核池，后续可继续扩展附件上传与审批流。</p>
          </div>
        </section>

        <section v-if="app.registrationStep === 2" class="step-panel is-active auth-form-block">
          <div class="review-card">
            <div class="review-icon"><span></span></div>
            <div>
              <h3>资料已就绪</h3>
              <p>提交后会自动进入审批流程，审核结果将通过系统通知返回。</p>
            </div>
          </div>
          <label class="checkbox agreement">
            <input v-model="app.registration.agreement" type="checkbox" />
            <span>我已阅读并同意 <a href="#" class="link-text">《停车场管理系统服务协议》</a></span>
          </label>
          <div class="step-actions">
            <button class="secondary-button" :disabled="app.registrationStep === 0" @click="app.registrationStep -= 1">上一步</button>
            <button class="primary-button" @click="app.registrationStep < 2 ? (app.registrationStep += 1) : app.handleRegister()">
              {{ app.registrationStep < 2 ? "下一步" : "提交审核" }}
            </button>
          </div>
        </section>
      </template>

      <template v-else>
        <div class="auth-links auth-links-top">
          <button type="button" class="link-button" @click="app.authScreen = 'login'">返回登录</button>
        </div>

        <div class="login-form auth-form-block">
          <label class="field">
            <span class="field-icon">@</span>
            <input v-model="app.resetForm.phone" type="tel" placeholder="找回账号绑定手机号" />
          </label>

          <div class="otp-row">
            <label class="field">
              <span class="field-icon">#</span>
              <input v-model="app.resetForm.otp" type="text" placeholder="短信验证码" />
            </label>
            <button class="ghost-button" type="button" @click="app.handleSendResetOtp">发送验证码</button>
          </div>

          <label class="field">
            <span class="field-icon">*</span>
            <input v-model="app.resetForm.newPassword" type="password" placeholder="设置新密码" />
          </label>

          <label class="field">
            <span class="field-icon">*</span>
            <input v-model="app.resetForm.confirmPassword" type="password" placeholder="再次确认新密码" />
          </label>

          <button class="primary-button wide" :disabled="app.resetLoading" @click="app.handleResetPassword">{{ app.resetLoading ? "提交中..." : "重置密码" }}</button>
        </div>
      </template>
    </section>
  </div>
</template>
