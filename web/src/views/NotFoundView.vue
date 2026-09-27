<template>
  <div class="relative min-h-[calc(100vh-8rem)] flex items-center justify-center p-8 overflow-hidden">
    <!-- Ghost heritage decorations (mockup 03) -->
    <div
      aria-hidden="true"
      class="absolute -left-14 -bottom-20 font-display font-bold text-[18rem] leading-[1] text-accent opacity-[0.04] select-none pointer-events-none"
    >
      Phả
    </div>
    <div aria-hidden="true" class="absolute right-14 top-16 hidden sm:flex items-center gap-1.5 opacity-50">
      <span class="w-2.5 h-2.5 rounded-full bg-gen-1"></span>
      <span class="w-2 h-2 rounded-full bg-gen-2"></span>
      <span class="w-2 h-2 rounded-full bg-gen-3"></span>
    </div>

    <div class="relative max-w-md text-center px-4" data-testid="not-found">
      <!-- Icon disc: terracotta-soft (pinned) with accent-fg glyph -->
      <div class="mx-auto w-20 h-20 rounded-full bg-terracotta-soft flex items-center justify-center mb-6">
        <IconExclamationCircle class="w-11 h-11 text-accent-fg" stroke-width="1.5" />
      </div>

      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-accent-fg leading-[1.45]">
        Đường dẫn không tồn tại
      </p>
      <p
        class="font-display font-bold text-terracotta dark:text-accent-fg text-7xl sm:text-8xl tracking-[-0.04em]"
        style="line-height: 1.05"
        aria-hidden="true"
      >
        404
      </p>
      <h1 class="mt-4 text-2xl font-bold text-ink-1 leading-[1.45]">Không tìm thấy trang</h1>
      <p class="mt-2 text-sm text-ink-2 leading-relaxed">
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
          variant="secondary"
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

      <p class="mt-6 text-xs text-ink-3 leading-relaxed">
        Hoặc
        <button
          type="button"
          class="text-accent-fg hover:underline cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-canvas"
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
