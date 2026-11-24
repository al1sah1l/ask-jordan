<script setup lang="ts">
import { computed } from "vue";
export type IconName = "arrow-right" | "arrow-left" | "check" | "plus" | "search" | "sparkles" |
  "star" | "sign-out" | "chevron-down" | "camera" | "film" | "pen" | "music" | "robot" | "game" | "ball" | "close";
const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 20 });
const paths: Record<IconName, string[]> = {
  "arrow-right": ["M5 12h14m-6-6 6 6-6 6"],
  "arrow-left": ["M19 12H5m6-6-6 6 6 6"],
  check: ["m5 12 4 4L19 6"],
  plus: ["M12 5v14M5 12h14"],
  search: ["M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Zm-2 5 6 6"],
  sparkles: ["m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"],
  star: ["m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"],
  "sign-out": ["M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4", "m16 8 4 4-4 4M10 12h10"],
  "chevron-down": ["m6 9 6 6 6-6"],
  camera: ["M9 4h6l2 3h3a1 1 0 0 1 1 1v11H3V8a1 1 0 0 1 1-1h3l2-3Z", "M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"],
  film: ["M4 4h16v16H4V4Zm4 0v16M16 4v16M4 8h4M4 16h4m8-8h4m-4 8h4"],
  pen: ["m4 20 4-1L20 7a2.1 2.1 0 0 0-3-3L5 16l-1 4Zm11-14 3 3M4 22h16"],
  music: ["M9 18V5l11-2v13M9 9l11-2", "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"],
  robot: ["M5 8h14v12H5V8Zm7-4v4M10 4h4M2 12v4m20-4v4M9 12h.01M15 12h.01M9 16h6"],
  game: ["M7 8h10a4 4 0 0 1 4 3l1 7a2 2 0 0 1-3 2l-4-3H9l-4 3a2 2 0 0 1-3-2l1-7a4 4 0 0 1 4-3Z", "M7 10v5m-2.5-2.5h5M16 12h.01M18 14h.01"],
  ball: ["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", "M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18"],
  close: ["m6 6 12 12M6 18 18 6"],
};
const strokes = computed(() => paths[props.name]);
</script>

<template>
  <svg class="app-icon" :width="size" :height="size" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <path v-for="(path, index) in strokes" :key="index" :d="path" />
  </svg>
</template>
