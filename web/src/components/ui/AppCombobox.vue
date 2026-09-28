<template>
  <div class="relative w-full" ref="containerRef">
    <label v-if="label" :for="inputId" class="text-sm font-medium text-ink-1 mb-1 block">
      {{ label }}
      <span v-if="required" class="text-danger-fg">*</span>
    </label>

    <!-- Selected State Chip View: gen-stripe card (spec §4.2 / §6.4) -->
    <div
      v-if="selectedMember"
      class="flex items-center justify-between p-2 rounded-app-lg border border-hairline bg-card text-xs shadow-e1"
      :style="selectedMember.generation_index ? { borderLeftWidth: '4px', borderLeftColor: `var(${genAccentVar(selectedMember.generation_index)})` } : {}"
      data-testid="combobox-selected-chip"
    >
      <div class="flex items-center space-x-2 min-w-0">
        <AppAvatar
          :src="selectedMember.avatar_url"
          :name="selectedMember.full_name"
          :generation="selectedMember.generation_index"
          size="w-6"
        />
        <span class="font-semibold text-ink-1 truncate">
          {{ selectedMember.full_name }}
        </span>
        <span
          v-if="selectedMember.generation_index"
          class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
          :style="genBadgeStyle(selectedMember.generation_index)"
        >
          Đời {{ selectedMember.generation_index }}
        </span>
        <span
          v-if="selectedMember.gender"
          :class="[
            'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-normal shrink-0',
            getGenderBadgeClass(selectedMember.gender),
          ]"
        >
          {{ genderLabel(selectedMember.gender) }}
        </span>
      </div>
      <button
        v-if="!disabled"
        type="button"
        class="text-ink-3 hover:text-ink-1 p-1 rounded-app-md transition-colors cursor-pointer shrink-0 ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
        aria-label="Xóa chọn"
        data-testid="combobox-clear-btn"
        @click="clearSelection"
      >
        <IconXMark class="w-4 h-4" />
      </button>
    </div>

    <!-- Trigger Input View -->
    <div v-else class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ink-3">
        <IconMagnifyingGlass class="w-4 h-4" />
      </div>
      <input
        :id="inputId"
        ref="inputRef"
        type="text"
        v-model="query"
        role="combobox"
        :aria-expanded="isOpen"
        :aria-controls="listboxId"
        aria-autocomplete="list"
        :placeholder="placeholder"
        :disabled="disabled"
        :class="[
          'block w-full rounded-app-md border pl-9 pr-3 py-2 text-sm text-ink-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus:border-transparent',
          error ? 'border-danger-fg text-danger-fg focus:ring-danger-fg' : 'border-hairline-strong bg-card hover:border-ink-3',
          disabled ? 'bg-well cursor-not-allowed text-ink-4' : '',
        ]"
        @focus="onFocus"
        @keydown="onKeyDown"
      />
    </div>

    <p v-if="error" class="mt-1 text-xs text-danger-fg leading-[1.45]">{{ error }}</p>

    <!-- Dropdown Listbox -->
    <ul
      v-if="isOpen && !selectedMember"
      :id="listboxId"
      role="listbox"
      class="absolute z-30 mt-1 w-full bg-card rounded-app-lg border border-hairline shadow-e2 max-h-60 overflow-y-auto divide-y divide-hairline py-1"
    >
      <li
        v-if="filteredOptions.length === 0"
        class="px-3 py-6 text-center"
        data-testid="combobox-empty"
      >
        <div
          class="mx-auto w-8 h-8 rounded-full bg-cream-muted text-ink-3 flex items-center justify-center mb-2"
          aria-hidden="true"
        >
          <IconMagnifyingGlass class="w-4 h-4" />
        </div>
        <p class="text-xs text-ink-2 leading-relaxed">{{ emptyText }}</p>
      </li>
      <li
        v-for="(member, idx) in filteredOptions"
        :key="member.id"
        role="option"
        :id="`${listboxId}-option-${idx}`"
        :aria-selected="idx === activeIndex"
        class="p-0"
        @mouseenter="activeIndex = idx"
        @click="selectMember(member)"
      >
        <button
          type="button"
          tabindex="-1"
          :class="[
            // Pinned test contract (INV-06): focus-visible:ring-2 + ring-terracotta + ring-offset-1.
            'w-full text-left px-3 py-2.5 text-xs flex items-center justify-between cursor-pointer transition-colors rounded-app-md focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta focus-visible:ring-offset-1 dark:focus-visible:ring-accent',
            idx === activeIndex ? 'bg-well text-ink-1' : 'hover:bg-quiet text-ink-1',
          ]"
        >
          <div class="flex items-center space-x-2.5 min-w-0">
            <AppAvatar
              :src="member.avatar_url"
              :name="member.full_name"
              :generation="member.generation_index"
              size="w-9"
            />
            <div class="truncate">
              <span class="font-semibold text-ink-1 block truncate">
                {{ member.full_name }}
              </span>
            </div>
          </div>

          <div class="flex items-center space-x-1.5 shrink-0 ml-2">
            <span
              v-if="member.generation_index"
              class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
              :style="genBadgeStyle(member.generation_index)"
            >
              Đời {{ member.generation_index }}
            </span>
            <span
              v-if="member.gender"
              :class="[
                'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-normal',
                getGenderBadgeClass(member.gender),
              ]"
            >
              {{ genderLabel(member.gender) }}
            </span>
          </div>
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, useId } from 'vue';
import AppAvatar from './AppAvatar.vue';
import { IconMagnifyingGlass, IconXMark } from '@/components/icons';
import { genAccentVar, genSoftVar } from '@/components/tree/card-visual';
import { getGenderBadgeClass } from '@/api/gender';

export interface ComboboxMember {
  id: string;
  full_name: string;
  generation_index?: number;
  gender?: string | null;
  avatar_url?: string | null;
}

interface Props {
  modelValue?: string | null;
  options: ComboboxMember[];
  label?: string;
  placeholder?: string;
  emptyText?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: null,
  options: () => [],
  label: '',
  placeholder: 'Tìm và chọn thành viên...',
  emptyText: 'Không tìm thấy kết quả phù hợp',
  error: '',
  disabled: false,
  required: false,
  id: '',
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | null): void;
  (e: 'select', member: ComboboxMember | null): void;
}>();

const generatedId = `app-combobox-${useId()}`;
const inputId = computed(() => props.id || generatedId);
const listboxId = computed(() => `${inputId.value}-listbox`);

const containerRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const query = ref('');
const isOpen = ref(false);
const activeIndex = ref(-1);

const selectedMember = computed(() => {
  if (!props.modelValue) return null;
  return props.options.find((m) => m.id === props.modelValue) || null;
});

const filteredOptions = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.options;
  return props.options.filter((m) => {
    return m.full_name.toLowerCase().includes(q);
  });
});

watch(filteredOptions, () => {
  activeIndex.value = -1;
});

watch(isOpen, (val) => {
  if (val) {
    activeIndex.value = -1;
  }
});

const onFocus = () => {
  if (!props.disabled) {
    isOpen.value = true;
  }
};

const selectMember = (member: ComboboxMember) => {
  emit('update:modelValue', member.id);
  emit('select', member);
  isOpen.value = false;
  query.value = '';
  activeIndex.value = -1;
};

const clearSelection = () => {
  emit('update:modelValue', null);
  emit('select', null);
  query.value = '';
  isOpen.value = false;
};

const onKeyDown = (event: KeyboardEvent) => {
  if (!isOpen.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    isOpen.value = true;
    event.preventDefault();
    return;
  }

  if (!isOpen.value) return;

  const count = filteredOptions.value.length;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (count > 0) {
      activeIndex.value = (activeIndex.value + 1) % count;
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (count > 0) {
      activeIndex.value = (activeIndex.value - 1 + count) % count;
    }
  } else if (event.key === 'Enter') {
    event.preventDefault();
    if (activeIndex.value >= 0 && activeIndex.value < count) {
      selectMember(filteredOptions.value[activeIndex.value]);
    }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    isOpen.value = false;
    activeIndex.value = -1;
    // A4: Escape closes the listbox and returns focus to the combobox trigger
    // (WAI-ARIA APG). Null-safe: in the selected-chip view the input is unmounted.
    inputRef.value?.focus();
  }
};

// Gen-tinted "Đời N" micro-badge (mockup 04): bg gen-N-soft + text gen-N, INV-02 line-height floor
const genBadgeStyle = (generation?: number): Record<string, string> => {
  if (!generation || generation <= 0) {
    return { backgroundColor: 'var(--color-terracotta-soft)', color: 'var(--color-terracotta-dark)', lineHeight: '1.45' };
  }
  return {
    backgroundColor: `var(${genSoftVar(generation)})`,
    color: `var(${genAccentVar(generation)}-fg)`,
    lineHeight: '1.45',
  };
};

const genderLabel = (gender?: string | null) => {
  const g = (gender || '').toLowerCase();
  if (g === 'male' || g === 'nam') return 'Nam';
  if (g === 'female' || g === 'nữ' || g === 'nu') return 'Nữ';
  return 'Khác';
};

const handleClickOutside = (e: MouseEvent) => {
  // Ignore clicks on nodes already detached from the document (e.g. an option
  // row removed mid-click) — contains() on a detached node is unreliable.
  if (!document.contains(e.target as Node)) {
    return;
  }
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
