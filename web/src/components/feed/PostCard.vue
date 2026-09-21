<template>
  <article class="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
    <header class="flex items-start space-x-3">
      <div
        class="w-10 h-10 rounded-full bg-[#F9EAE1] text-[#B24E2A] flex items-center justify-center font-semibold text-sm shrink-0 select-none"
        aria-hidden="true"
      >
        {{ initials }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-slate-800 truncate" data-testid="post-author">
          {{ post.author_display_name }}
        </p>
        <time
          class="text-xs text-slate-500"
          :datetime="post.created_at"
          data-testid="post-date"
        >
          {{ formattedDate }}
        </time>
      </div>
    </header>

    <p class="mt-3 text-sm text-slate-700 whitespace-pre-wrap break-words leading-relaxed">
      {{ post.content }}
    </p>

    <ImageGrid v-if="post.images && post.images.length > 0" :images="post.images" />
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ImageGrid from './ImageGrid.vue';
import type { FeedPostItem } from '@/types/api';

interface Props {
  post: FeedPostItem;
}

const props = defineProps<Props>();

const initials = computed(() => {
  const name = props.post.author_display_name?.trim() || '';
  if (!name) return '?';
  // Vietnamese names are "Họ Tên đệm + Tên": initials come from first + last word
  const words = name.split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? words[words.length - 1]?.charAt(0) ?? '' : '';
  return (first + last).toUpperCase();
});

const formattedDate = computed(() => {
  const date = new Date(props.post.created_at);
  if (Number.isNaN(date.getTime())) return props.post.created_at;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
});
</script>
