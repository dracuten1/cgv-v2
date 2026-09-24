<template>
  <div
    class="flex flex-col items-center bg-white/90 backdrop-blur rounded-full shadow-md border border-slate-200 p-1.5 select-none"
    data-testid="tree-compass"
  >
    <!-- North -->
    <button
      type="button"
      class="w-6 h-6 flex items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
      aria-label="Di chuyển lên"
      data-testid="compass-north"
      @click="onPan(0, COMPASS_PAN_STEP)"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>

    <!-- West, Center, East -->
    <div class="flex items-center gap-1 my-0.5">
      <button
        type="button"
        class="w-6 h-6 flex items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
        aria-label="Di chuyển sang trái"
        data-testid="compass-west"
        @click="onPan(COMPASS_PAN_STEP, 0)"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <!-- Center (Reset origin or focus Tôi) -->
      <button
        type="button"
        class="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors focus:outline-none"
        aria-label="Về trung tâm"
        data-testid="compass-center"
        @click="onCenter"
      >
        <div class="w-2 h-2 rounded-full bg-slate-700" />
      </button>

      <button
        type="button"
        class="w-6 h-6 flex items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
        aria-label="Di chuyển sang phải"
        data-testid="compass-east"
        @click="onPan(-COMPASS_PAN_STEP, 0)"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>

    <!-- South -->
    <button
      type="button"
      class="w-6 h-6 flex items-center justify-center rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none"
      aria-label="Di chuyển xuống"
      data-testid="compass-south"
      @click="onPan(0, -COMPASS_PAN_STEP)"
    >
      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'TreeCompassControl' });

const COMPASS_PAN_STEP = 80;

const emit = defineEmits<{
  (e: 'pan', dx: number, dy: number): void;
  (e: 'center'): void;
}>();

function onPan(dx: number, dy: number): void {
  emit('pan', dx, dy);
}

function onCenter(): void {
  emit('center');
}
</script>
