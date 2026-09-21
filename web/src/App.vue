<template>
  <AppLayout>
    <router-view />
    <ToastHost />
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import AppLayout from '@/components/layout/AppLayout.vue';
import ToastHost from '@/components/ui/ToastHost.vue';
import { useToast } from '@/composables/useToast';
import { useRegisterSW } from 'virtual:pwa-register/vue';

const toast = useToast();

const { needRefresh, updateServiceWorker } = useRegisterSW({
  immediate: true,
  onNeedRefresh() {
    toast.show(
      'Đã có phiên bản mới của Cây Gia Phả.',
      'info',
      {
        label: 'Tải lại',
        onClick: () => {
          updateServiceWorker(true);
        },
      },
      0 // keep visible until clicked
    );
  },
  onOfflineReady() {
    toast.info('Ứng dụng đã sẵn sàng hoạt động ngoại tuyến.');
  },
});

onMounted(() => {
  if (needRefresh.value) {
    toast.show(
      'Đã có phiên bản mới của Cây Gia Phả.',
      'info',
      {
        label: 'Tải lại',
        onClick: () => {
          updateServiceWorker(true);
        },
      },
      0
    );
  }
});
</script>
