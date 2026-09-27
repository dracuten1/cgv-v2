<template>
  <div :class="['flex flex-col', fullWidth ? 'w-full' : '']">
    <label v-if="label" :for="selectId" class="text-sm font-medium text-ink-1 mb-1">
      {{ label }}
      <span v-if="required" class="text-danger-fg">*</span>
    </label>
    <div class="relative">
      <select
        :id="selectId"
        :value="modelValue"
        :disabled="disabled"
        :required="required"
        :class="[
          'block w-full rounded-app-md border px-3 py-2 text-sm text-ink-1 bg-card transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus:border-transparent',
          error ? 'border-danger-fg text-danger-fg focus:ring-danger-fg' : 'border-hairline-strong hover:border-ink-3',
          disabled ? 'bg-well cursor-not-allowed text-ink-4' : 'cursor-pointer',
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
    <p v-if="error" class="mt-1 text-xs text-danger-fg leading-[1.45]">{{ error }}</p>
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
