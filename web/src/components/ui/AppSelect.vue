<template>
  <div :class="['flex flex-col', fullWidth ? 'w-full' : '']">
    <label v-if="label" :for="selectId" class="text-sm font-medium text-slate-700 mb-1">
      {{ label }}
      <span v-if="required" class="text-red-500">*</span>
    </label>
    <div class="relative">
      <select
        :id="selectId"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        :class="[
          'block w-full rounded-lg border px-3 py-2 text-sm text-slate-800 bg-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus:border-transparent',
          error ? 'border-red-500 text-red-900 focus:ring-red-500' : 'border-slate-300 hover:border-slate-400',
          disabled ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'cursor-pointer',
        ]"
        @change="onChange"
      >
        <option v-if="placeholder" value="" disabled :selected="!modelValue">
          {{ placeholder }}
        </option>
        <option
          v-for="opt in options"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </select>
    </div>
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface SelectOption {
  value: string | number;
  label: string;
}

interface Props {
  modelValue?: string | number | null;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  fullWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: '',
  placeholder: '',
  error: '',
  disabled: false,
  required: false,
  id: '',
  fullWidth: true,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void;
}>();

const selectId = computed(() => props.id || `select-${Math.random().toString(36).substring(2, 9)}`);

const onChange = (event: Event) => {
  const target = event.target as HTMLSelectElement;
  emit('update:modelValue', target.value);
};
</script>
