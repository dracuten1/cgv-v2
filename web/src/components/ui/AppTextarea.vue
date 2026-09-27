<template>
  <div :class="['flex flex-col', fullWidth ? 'w-full' : '']">
    <label v-if="label" :for="textareaId" class="text-sm font-medium text-ink-1 mb-1">
      {{ label }}
      <span v-if="required" class="text-danger-fg">*</span>
    </label>
    <div class="relative">
      <textarea
        :id="textareaId"
        :value="modelValue"
        :rows="rows"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :maxlength="maxlength"
        :class="[
          'block w-full transition-colors',
          variantClasses,
          error ? 'border-danger-fg text-danger-fg focus:ring-danger-fg' : '',
          disabled ? 'bg-well cursor-not-allowed text-ink-4' : '',
        ]"
        @input="onInput"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      ></textarea>
    </div>
    <p v-if="error" class="mt-1 text-xs text-danger-fg leading-[1.45]">{{ error }}</p>
    <p v-else-if="hint" class="mt-1 text-xs text-ink-3 leading-[1.45]">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  modelValue?: string | number | null;
  variant?: 'borderless' | 'bordered';
  rows?: number;
  label?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  fullWidth?: boolean;
  /** Max characters (client mirror of the backend rune budget). */
  maxlength?: number;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  variant: 'borderless',
  rows: 3,
  label: '',
  placeholder: '',
  error: '',
  hint: '',
  disabled: false,
  required: false,
  id: '',
  fullWidth: true,
  maxlength: undefined,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
}>();

let uniqueIdCounter = 0;
const generatedId = `app-textarea-${++uniqueIdCounter}`;
const textareaId = computed(() => props.id || generatedId);

const variantClasses = computed(() => {
  if (props.variant === 'bordered') {
    // Pinned test contract: border / border-slate-300 (compat class retained).
    return 'rounded-app-md border border-slate-300 bg-card px-3 py-2 text-sm text-ink-1 hover:border-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus:border-transparent resize-y';
  }
  // borderless variant (default for composer)
  return 'bg-transparent resize-none border-0 px-0 py-2 text-base text-ink-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-inset';
});

const onInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
};
</script>
