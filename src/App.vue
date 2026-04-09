<script setup>
import { proxyRefs } from "vue";
import AuthScreen from "./components/AuthScreen.vue";
import ConsoleView from "./components/ConsoleView.vue";
import ToastNotice from "./components/ToastNotice.vue";
import UserPortalView from "./components/UserPortalView.vue";
import { useParkingSystem } from "./composables/useParkingSystem";

const app = proxyRefs(useParkingSystem());
</script>

<template>
  <AuthScreen v-if="!app.auth.token" :app="app" />
  <UserPortalView v-else-if="app.isUserPortal" :app="app" />
  <ConsoleView v-else :app="app" />
  <ToastNotice :app="app" />
</template>
