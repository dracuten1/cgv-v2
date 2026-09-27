<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        @click.self="onBackdropClick"
      >
        <div
          class="relative w-full max-w-lg bg-card rounded-app-2xl shadow-e3 border border-hairline overflow-hidden transform transition-all flex flex-col max-h-[90vh]"
          role="dialog"
          aria-modal="true"
        >
          <!-- Header -->
          <div v-if="title || $slots.header" class="px-6 py-4 border-b border-hairline flex items-center justify-between">
            <slot name="header">
              <h3 class="text-lg font-bold text-ink-1 font-body">{{ title }}</h3>
            </slot>
            <button
              v-if="closable"
              type="button"
              class="text-ink-3 hover:text-ink-1 rounded-app-md p-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              @click="$emit('close')"
            >
              <span class="sr-only">Đóng</span>
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-4 overflow-y-auto flex-1">
            <slot />
          </div>

          <!-- Footer -->
          <div v-if="$slots.footer" class="px-6 py-3 bg-quiet border-t border-hairline flex items-center justify-end space-x-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  open: boolean;
  title?: string;
  closable?: boolean;
  closeOnBackdrop?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  open: false,
  title: '',
  closable: true,
  closeOnBackdrop: true,
});

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const onBackdropClick = () => {
  if (props.closeOnBackdrop && props.closable) {
    emit('close');
  }
};
</script>
