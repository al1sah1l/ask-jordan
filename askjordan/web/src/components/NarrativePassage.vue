<script setup lang="ts">
import { computed } from "vue";
import { narrativeParagraphs } from "../utils/narrative";
const props = defineProps<{ text: string }>();
const paragraphs = computed(() => narrativeParagraphs(props.text));
</script>

<template>
  <div class="narrative-passage">
    <p v-for="(paragraph, index) in paragraphs" :key="index" class="chapter-narrative">{{ paragraph }}</p>
  </div>
</template>
