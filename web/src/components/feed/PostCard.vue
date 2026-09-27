<template>
  <article class="rounded-app-xl border border-hairline bg-card p-[18px] shadow-e1 md:p-[22px]">
    <header class="flex items-start gap-3">
      <AppAvatar :name="post.author_display_name" size="w-10" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold leading-[1.45] text-ink-1" data-testid="post-author">
          {{ post.author_display_name }}
        </p>
        <time
          class="text-xs leading-[1.45] tabular-nums text-ink-3"
          :datetime="post.created_at"
          data-testid="post-date"
        >
          {{ formattedDate }}
        </time>
      </div>
    </header>

    <p class="mt-4 break-words whitespace-pre-wrap text-sm leading-[1.65] text-ink-1">
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
