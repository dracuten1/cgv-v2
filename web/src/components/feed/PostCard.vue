<template>
  <article class="bg-white rounded-xl shadow-xs border border-slate-200 p-5">
    <header class="flex items-start space-x-3">
      <AppAvatar :name="post.author_display_name" size="w-10" />
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
import AppAvatar from '@/components/ui/AppAvatar.vue';
import type { FeedPostItem } from '@/types/api';

interface Props {
  post: FeedPostItem;
}

const props = defineProps<Props>();

const formattedDate = computed(() => {
  const date = new Date(props.post.created_at);
  if (Number.isNaN(date.getTime())) return props.post.created_at;
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
});
</script>
