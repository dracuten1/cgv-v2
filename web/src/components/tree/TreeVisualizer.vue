<template>
  <div
    ref="viewportEl"
    class="tree-viewport relative overflow-hidden rounded-xl bg-white border border-slate-200 select-none"
    style="touch-action: none; height: calc(100dvh - 4rem - 5rem - env(safe-area-inset-bottom, 0px)); min-height: 480px;"
    :data-view-centered="centeredTarget"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
    @wheel="onWheel"
  >
    <!-- Empty state inside viewport -->
    <div
      v-if="!store.loading && layout.nodes.length === 0"
      class="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <p class="text-slate-400 text-sm">Chưa có dữ liệu gia phả.</p>
    </div>

    <!-- Transformed world layer: bands + canvas edges + node cards -->
    <div
      v-if="layout.nodes.length > 0"
      class="absolute top-0 left-0 origin-top-left"
      :style="{
        transform: `translate3d(${transform.tx}px, ${transform.ty}px, 0) scale(${transform.zoom})`,
        willChange: 'transform',
      }"
      data-testid="tree-world"
    >
      <!-- Generation bands (background stripes + "Đời thứ N" labels) -->
      <div
        v-for="band in layout.bands"
        :key="`band-${band.index}`"
        class="absolute left-0"
        :style="{
          top: `${band.y}px`,
          width: `${layout.width}px`,
          height: `${band.height}px`,
          backgroundColor: `var(${band.colorSoftVar}, transparent)`,
        }"
        :data-testid="`band-gen-${band.index}`"
      >
        <span
          class="absolute left-4 top-2 text-xs font-semibold font-display uppercase tracking-wide"
          :style="{ color: `var(${band.colorVar}, #64748B)` }"
        >
          {{ band.label }}
        </span>
      </div>

      <!-- Canvas connector layer (parent→child curves + spouse links) -->
      <canvas
        ref="canvasEl"
        class="absolute top-0 left-0 pointer-events-none"
        :width="Math.ceil(layout.width)"
        :height="Math.ceil(layout.height)"
        :style="{ width: `${layout.width}px`, height: `${layout.height}px` }"
        aria-hidden="true"
      />

      <!-- Culled HTML node cards (DOM budget < 300) -->
      <TreeNodeCard
        v-for="node in culled.visible"
        :key="node.id"
        :node="node"
        :selected="node.id === store.selectedId"
        :collapsed="culled.collapsed"
        @select="onNodeSelect"
      />
    </div>

    <!-- Floating navigation & zoom controls (bottom-right cluster) -->
    <div class="absolute right-3 bottom-3 flex flex-col items-center gap-2 z-10">
      <!-- Compass 4-way pan & center control -->
      <TreeCompassControl
        @pan="panBy"
        @center="handleCompassCenter"
      />

      <!-- Zoom & Fit controls -->
      <div class="flex flex-col gap-1.5">
        <button
          type="button"
          class="w-8 h-8 rounded-lg bg-white/95 border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs flex items-center justify-center cursor-pointer text-lg leading-none"
          aria-label="Phóng to"
          data-testid="zoom-in"
          @click="zoomBy(1.2)"
        >
          +
        </button>
        <button
          type="button"
          class="w-8 h-8 rounded-lg bg-white/95 border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs flex items-center justify-center cursor-pointer text-lg leading-none"
          aria-label="Thu nhỏ"
          data-testid="zoom-out"
          @click="zoomBy(1 / 1.2)"
        >
          −
        </button>
        <button
          type="button"
          class="w-8 h-8 rounded-lg bg-white/95 border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-xs flex items-center justify-center cursor-pointer"
          aria-label="Vừa khung nhìn"
          data-testid="fit-view"
          @click="fitView"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRefs, watch } from 'vue';
import TreeNodeCard from './TreeNodeCard.vue';
import TreeCompassControl from './TreeCompassControl.vue';
import { useTreeStore } from '@/stores/tree';
import { useAuthStore } from '@/stores/auth';
import {
  useTreeLayout,
  cullVisibleNodes,
  fitToViewport,
} from '@/composables/useTreeLayout';
import { useTreeViewport } from '@/composables/useTreeViewport';
import { TREE_CONNECTOR_COLOR, TREE_CONNECTOR_NODE_COLOR } from './treeTokens';

defineOptions({ name: 'TreeVisualizer' });

const store = useTreeStore();
const authStore = useAuthStore();

const viewportEl = ref<HTMLElement | null>(null);
const canvasEl = ref<HTMLCanvasElement | null>(null);

const { roots: rootsRef, generations: generationsRef, generationFilter: filterRef } = toRefs(store);
const linkedMemberRef = computed(() => authStore.user?.member_id);

/** MEMOIZED: re-runs only when roots, generationFilter, or linkedMemberId change. */
const layout = useTreeLayout(rootsRef, generationsRef, filterRef, linkedMemberRef);

const {
  transform,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onWheel,
  zoomBy,
  panBy,
  setTransform,
  worldViewport,
} = useTreeViewport(viewportEl);

/**
 * Culled visible set: re-evaluates on pan/zoom/layout changes only —
 * selection never touches this (selection is a primitive ref read).
 */
const culled = computed(() =>
  cullVisibleNodes(layout.value, worldViewport(), transform.zoom)
);

/** Has initial positioning (auto-center or fitView) executed? */
const hasInitialCentered = ref(false);
const centeredTarget = ref<string | null>(null);

function fitView(): void {
  const rect = viewportEl.value?.getBoundingClientRect();
  const width = rect?.width || 800;
  const height = rect?.height || 600;
  const { zoom, tx, ty } = fitToViewport(layout.value, { width, height });
  setTransform(zoom, tx, ty);
  centeredTarget.value = 'fit';
}

/**
 * Focus viewport on a specific node (centered at zoom 1.0).
 * Returns true if the node was found and centered, false otherwise.
 */
function focusNode(nodeId: string): boolean {
  const target = layout.value.nodes.find((n) => n.id === nodeId);
  if (!target) return false;

  const rect = viewportEl.value?.getBoundingClientRect();
  const width = rect?.width || 800;
  const height = rect?.height || 600;

  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;

  const zoom = 1.0;
  const tx = width / 2 - targetCenterX * zoom;
  const ty = height / 2 - targetCenterY * zoom;

  setTransform(zoom, tx, ty);
  return true;
}

/**
 * Auto-center on initial layout: focuses on "Tôi" node at zoom 1.0 if linked,
 * otherwise falls back to fitView().
 */
function autoCenterInitial(): void {
  const selfId = authStore.user?.member_id;
  if (selfId && focusNode(selfId)) {
    centeredTarget.value = 'self';
    return;
  }
  fitView();
}

/**
 * Compass Center button handler: focus "Tôi" node if linked,
 * else reset transform to (1, 0, 0).
 */
function handleCompassCenter(): void {
  const selfId = authStore.user?.member_id;
  if (selfId && focusNode(selfId)) {
    return;
  }
  setTransform(1, 0, 0);
}

function drawEdges(): void {
  const canvas = canvasEl.value;
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return; // jsdom: getContext returns null — safe no-op

  // M11 Canvas Backing-Store & DPR Guard
  let dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  const pixelCount = layout.value.width * dpr * layout.value.height * dpr;
  if (pixelCount > 16_777_216) {
    console.warn('Canvas backing store exceeds 16M pixels; falling back to dpr=1 to prevent texture overflow');
    dpr = 1;
  }

  if (canvas.width !== Math.ceil(layout.value.width * dpr) || canvas.height !== Math.ceil(layout.value.height * dpr)) {
    canvas.width = Math.ceil(layout.value.width * dpr);
    canvas.height = Math.ceil(layout.value.height * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, layout.value.width, layout.value.height);

  // Read CSS variables once per layout pass (Token-vs-Hex discipline).
  // Fallback hexes live in treeTokens.ts — single source of truth for canvas-only constants.
  let connectorColor = TREE_CONNECTOR_COLOR;
  let nodeColor = TREE_CONNECTOR_NODE_COLOR;
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const style = getComputedStyle(document.documentElement);
    connectorColor = style.getPropertyValue('--tree-connector').trim() || TREE_CONNECTOR_COLOR;
    nodeColor = style.getPropertyValue('--tree-connector-node').trim() || TREE_CONNECTOR_NODE_COLOR;
  }

  // Render orthogonal edges if available, otherwise fallback to legacy edges
  const orthoEdges = layout.value.orthogonalEdges;
  if (orthoEdges && orthoEdges.length > 0) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = connectorColor;

    for (const edge of orthoEdges) {
      for (const seg of edge.segments) {
        ctx.beginPath();
        ctx.moveTo(seg.x1, seg.y1);
        ctx.lineTo(seg.x2, seg.y2);
        ctx.stroke();
      }

      // Midpoint junction dot for spouse connectors (r = 3px)
      if (edge.midpoint) {
        ctx.beginPath();
        ctx.fillStyle = nodeColor;
        ctx.arc(edge.midpoint.x, edge.midpoint.y, edge.midpoint.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else {
    for (const edge of layout.value.edges) {
      ctx.beginPath();
      if (edge.type === 'spouse') {
        ctx.strokeStyle = connectorColor;
        ctx.lineWidth = 2;
        ctx.moveTo(edge.fromX, edge.fromY);
        ctx.lineTo(edge.toX, edge.toY);
        ctx.stroke();
      } else {
        ctx.strokeStyle = connectorColor;
        ctx.lineWidth = 2;
        const midY = (edge.fromY + edge.toY) / 2;
        ctx.moveTo(edge.fromX, edge.fromY);
        ctx.bezierCurveTo(edge.fromX, midY, edge.toX, midY, edge.toX, edge.toY);
        ctx.stroke();
      }
    }
  }
}

function onNodeSelect(id: string): void {
  store.selectMember(id);
}

onMounted(async () => {
  await nextTick();
  drawEdges();
  if (layout.value.nodes.length > 0) {
    if (!hasInitialCentered.value) {
      autoCenterInitial();
      hasInitialCentered.value = true;
    } else {
      fitView();
    }
  }
});

// Redraw edges when the layout changes (filter / refetch)
watch(layout, async () => {
  await nextTick();
  drawEdges();
  if (layout.value.nodes.length > 0) {
    if (!hasInitialCentered.value) {
      autoCenterInitial();
      hasInitialCentered.value = true;
    } else {
      fitView();
    }
  }
});

// Redraw after culled set changes visibility of canvas siblings (same size)
watch(culled, () => {
  drawEdges();
});
</script>
