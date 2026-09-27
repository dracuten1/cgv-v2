<template>
  <div :class="['flex flex-col', fullWidth ? 'w-full' : '']">
    <label v-if="label" :for="inputId" class="text-sm font-medium text-ink-1 mb-1">
      {{ label }}
      <span v-if="required" class="text-danger-fg">*</span>
    </label>
    <div class="relative rounded-app-md shadow-xs">
      <div
        v-if="hasLeading"
        class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-3"
        aria-hidden="true"
      >
        <slot name="leading" />
      </div>
      <input
        :id="inputId"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :class="[
          'block w-full rounded-app-md border py-2 pr-3 text-sm text-ink-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus:border-transparent',
          hasLeading ? 'pl-9' : 'px-3',
          error ? 'border-danger-fg text-danger-fg focus:ring-danger-fg' : 'border-hairline-strong bg-card hover:border-ink-3',
          disabled ? 'bg-well cursor-not-allowed text-ink-4' : '',
        ]"
        @input="onInput"
        @blur="$emit('blur', $event)"
        @focus="$emit('focus', $event)"
      />
    </div>
    <p v-if="error" class="mt-1 text-xs text-danger-fg leading-[1.45]">{{ error }}</p>
    <p v-else-if="hint" class="mt-1 text-xs text-ink-3 leading-[1.45]">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue';

interface Props {
  modelValue?: string | number | null;
  label?: string;
  type?: string;
  placeholder?: string;
  error?: string;
  hint?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  fullWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  label: '',
  type: 'text',
  placeholder: '',
  error: '',
  hint: '',
  disabled: false,
  required: false,
  id: '',
  fullWidth: true,
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'blur', event: FocusEvent): void;
  (e: 'focus', event: FocusEvent): void;
}>();

const inputId = computed(() => props.id || `input-${Math.random().toString(36).substring(2, 9)}`);

/** Leading-icon slot present → pad the input left (pl-9) instead of px-3. */
const slots = useSlots();
const hasLeading = computed(() => Boolean(slots.leading));

const onInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
};
</script>
