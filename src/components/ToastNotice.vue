<script setup>
defineProps({
  app: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <div v-if="app.toast.visible" class="toast is-visible">
    <div class="toast-icon"></div>
    <div>
      <strong>{{ app.toast.title }}</strong>
      <p>{{ app.toast.message }}</p>
    </div>
  </div>
</template>
