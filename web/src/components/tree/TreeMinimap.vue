<template>
  <div
    v-if="layout.nodes.length > 0"
    class="tr-minimap absolute left-3 bottom-3 z-20 w-44 p-2 bg-card/90 backdrop-blur-md border border-hairline shadow-e2 rounded-xl select-none max-md:hidden"
    aria-label="Sơ đồ nhỏ — vị trí khung nhìn trong cây"
    data-testid="tree-minimap"
  >
    <!-- Header label -->
    <div class="tr-minimap__label flex justify-between items-center text-[9px] font-semibold tracking-wider uppercase text-ink-3 mb-1.5 leading-snug">
      <span>Sơ đồ nhỏ</span>
      <span class="mono font-mono text-ink-3">{{ layout.nodes.length }}</span>
    </div>

    <!-- Map preview container -->
    <div
      ref="mapEl"
      class="tr-minimap__map relative h-16 w-full rounded border border-hairline bg-surface-well overflow-hidden cursor-crosshair"
      data-testid="minimap-map"
      @pointerdown="onMapPointerDown"
    >
      <!-- Generation bands -->
      <template v-if="layout.orientation === 'horizontal'">
        <div
          v-for="band in layout.bands"
          :key="`mm-band-${band.index}`"
          class="tr-minimap__band absolute top-0 bottom-0"
          :style="{
            left: `${bandRelative(band).coordPct}%`,
            width: `${bandRelative(band).sizePct}%`,
            backgroundColor: `var(${band.colorSoftVar}, rgba(0,0,0,0.03))`
          }"
        />
      </template>
      <template v-else>
        <div
          v-for="band in layout.bands"
          :key="`mm-band-${band.index}`"
          class="tr-minimap__band absolute left-0 right-0"
          :style="{
            top: `${bandRelative(band).coordPct}%`,
            height: `${bandRelative(band).sizePct}%`,
            backgroundColor: `var(${band.colorSoftVar}, rgba(0,0,0,0.03))`
          }"
        />
      </template>

      <!-- Mini dots for nodes (capped at 150 for perf in minimap) -->
      <span
        v-for="dot in miniDots"
        :key="`mm-dot-${dot.id}`"
        class="tr-minimap__dot absolute w-1.5 h-1.5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        :style="{
          left: `${dot.xPct}%`,
          top: `${dot.yPct}%`,
          backgroundColor: `var(${dot.colorVar}, #888)`
        }"
      />

      <!-- Active viewport rectangle -->
      <div
        class="tr-minimap__vp absolute border-[1.5px] border-accent rounded-xs shadow-xs pointer-events-none"
        data-testid="minimap-viewport-rect"
        :style="{
          left: `${vpRect.leftPct}%`,
          top: `${vpRect.topPct}%`,
          width: `${vpRect.widthPct}%`,
          height: `${vpRect.heightPct}%`,
        }"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TreeLayout, GenerationBand } from '@/composables/useTreeLayout';
import type { TransformState } from '@/composables/useTreeViewport';
import { genAccentVar } from '@/components/tree/card-visual';

const props = defineProps<{
  layout: TreeLayout;
  transform: TransformState;
  viewportWidth: number;
  viewportHeight: number;
}>();

const emit = defineEmits<{
  (e: 'panTo', targetWorldX: number, targetWorldY: number): void;
}>();

const mapEl = ref<HTMLElement | null>(null);

function bandRelative(band: GenerationBand) {
  const totalDim = props.layout.orientation === 'horizontal' ? props.layout.width : props.layout.height;
  const safeDim = Math.max(1, totalDim);
  const coordPct = Math.max(0, Math.min(100, (band.coord / safeDim) * 100));
  const sizePct = Math.max(0, Math.min(100, (band.size / safeDim) * 100));
  return { coordPct, sizePct };
}

const miniDots = computed(() => {
  const safeW = Math.max(1, props.layout.width);
  const safeH = Math.max(1, props.layout.height);
  // Cap at 150 representative nodes to keep minimap lightweight
  const nodes = props.layout.nodes.slice(0, 150);
  return nodes.map((node) => ({
    id: node.id,
    xPct: Math.max(0, Math.min(100, ((node.x + node.width / 2) / safeW) * 100)),
    yPct: Math.max(0, Math.min(100, ((node.y + node.height / 2) / safeH) * 100)),
    colorVar: genAccentVar(node.generation_index),
  }));
});

const vpRect = computed(() => {
  const safeW = Math.max(1, props.layout.width);
  const safeH = Math.max(1, props.layout.height);
  const zoom = Math.max(0.01, props.transform.zoom);

  // World coordinates visible in viewport
  const worldX = -props.transform.tx / zoom;
  const worldY = -props.transform.ty / zoom;
  const worldW = props.viewportWidth / zoom;
  const worldH = props.viewportHeight / zoom;

  // Convert to percentages within layout world bounds
  const rawLeftPct = (worldX / safeW) * 100;
  const rawTopPct = (worldY / safeH) * 100;
  const rawWidthPct = (worldW / safeW) * 100;
  const rawHeightPct = (worldH / safeH) * 100;

  // Clamp geometry for safe display inside the minimap preview
  const leftPct = Math.max(-20, Math.min(120, rawLeftPct));
  const topPct = Math.max(-20, Math.min(120, rawTopPct));
  const widthPct = Math.max(2, Math.min(150, rawWidthPct));
  const heightPct = Math.max(2, Math.min(150, rawHeightPct));

  return { leftPct, topPct, widthPct, heightPct };
});

function handleMapInteraction(event: PointerEvent) {
  const rect = mapEl.value?.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return;

  const clickXPct = (event.clientX - rect.left) / rect.width;
  const clickYPct = (event.clientY - rect.top) / rect.height;

  const targetWorldX = clickXPct * props.layout.width;
  const targetWorldY = clickYPct * props.layout.height;

  emit('panTo', targetWorldX, targetWorldY);
}

function onMapPointerDown(event: PointerEvent) {
  // Prevent canvas capturing or bubbling
  event.stopPropagation();
  handleMapInteraction(event);

  const el = event.currentTarget as HTMLElement | null;
  el?.setPointerCapture?.(event.pointerId);

  const onPointerMove = (e: PointerEvent) => {
    handleMapInteraction(e);
  };

  const onPointerUp = (e: PointerEvent) => {
    el?.releasePointerCapture?.(e.pointerId);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };

  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}
</script>
