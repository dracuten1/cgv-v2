<template>
  <div :class="['flex flex-col', fullWidth ? 'w-full' : '']">
    <label v-if="label" :for="textareaId" class="text-sm font-medium text-slate-700 mb-1">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
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
          error ? 'border-red-500 text-red-900 focus:ring-red-500' : '',
          disabled ? 'bg-slate-100 cursor-not-allowed text-slate-500' : '',
        ]"
        @input="onInput"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      ></textarea>
    </div>
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
    <p v-else-if="hint" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
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
    return 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-transparent resize-y';
  }
  // borderless variant (default for composer)
  return 'bg-transparent resize-none border-0 px-0 py-2 text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0';
});

const onInput = (event: Event) => {
  const target = event.target as HTMLTextAreaElement;
  emit('update:modelValue', target.value);
};
</script>
