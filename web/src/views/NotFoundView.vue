<template>
  <div class="relative min-h-[calc(100vh-8rem)] flex items-center justify-center p-8 overflow-hidden">
    <!-- Ghost heritage decorations (mockup 03) -->
    <div
      aria-hidden="true"
      class="absolute -left-14 -bottom-20 font-display font-bold text-[18rem] leading-[1] text-terracotta opacity-[0.04] select-none pointer-events-none"
    >
      Phả
    </div>
    <div aria-hidden="true" class="absolute right-14 top-16 hidden sm:flex items-center gap-1.5 opacity-50">
      <span class="w-2.5 h-2.5 rounded-full bg-gen-1"></span>
      <span class="w-2 h-2 rounded-full bg-gen-2"></span>
      <span class="w-2 h-2 rounded-full bg-gen-3"></span>
    </div>

    <div class="relative max-w-md text-center px-4" data-testid="not-found">
      <!-- Icon disc: lost-branch illustration -->
      <div class="mx-auto w-20 h-20 rounded-full bg-terracotta-soft flex items-center justify-center mb-6">
        <IconExclamationCircle class="w-11 h-11 text-terracotta" stroke-width="1.5" />
      </div>

      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-terracotta mb-2" style="line-height: 1.45">
        Lỗi 404
      </p>
      <p
        class="font-display font-bold text-terracotta text-7xl sm:text-8xl"
        style="line-height: 1.05"
        aria-hidden="true"
      >
        404
      </p>
      <h1 class="mt-4 text-2xl font-bold font-display text-slate-800">Không tìm thấy trang</h1>
      <p class="mt-2 text-sm text-slate-500 leading-relaxed">
        Đường dẫn bạn yêu cầu không tồn tại hoặc đã được chuyển dời — như một nhánh đã lìa khỏi cây
        phả hệ.
      </p>

      <div class="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
        <AppButton
          variant="primary"
          size="lg"
          to="/tree"
          data-testid="not-found-home"
        >
          <span class="flex items-center justify-center gap-2">
            <IconArrowLeft class="w-4 h-4" />
            <span>Về cây gia phả</span>
          </span>
        </AppButton>
        <AppButton
          variant="ghost"
          size="lg"
          to="/kinship"
          data-testid="not-found-kinship"
        >
          <span class="flex items-center justify-center gap-2">
            <IconMagnifyingGlass class="w-4 h-4" />
            <span>Tìm người trong họ</span>
          </span>
        </AppButton>
      </div>

      <p class="mt-6 text-xs text-slate-400">
        Hoặc
        <button
          type="button"
          class="text-terracotta hover:text-terracotta-hover hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-1"
          @click="router.back()"
        >
          quay lại trang trước
        </button>.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppButton from '@/components/ui/AppButton.vue';
import { IconArrowLeft, IconMagnifyingGlass, IconExclamationCircle } from '@/components/icons';

const router = useRouter();
</script>
