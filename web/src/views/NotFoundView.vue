<template>
  <div class="p-12 max-w-md mx-auto text-center">
    <div class="w-16 h-16 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
      <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <h1 class="text-2xl font-bold font-display text-slate-800 mb-2">Không tìm thấy trang</h1>
    <p class="text-slate-500 mb-6">Đường dẫn bạn yêu cầu không tồn tại hoặc đã được chuyển dời.</p>
    <router-link
      to="/tree"
      class="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg bg-[#C85A32] text-white hover:bg-[#B24E2A] transition-colors"
    >
      Về trang chủ cây phả hệ
    </router-link>
  </div>
</template>

<script setup lang="ts">
// 404 Not Found view
</script>
