<script setup lang="ts">
import { ref, useId } from "vue";
import MotionReveal from "./MotionReveal.vue";
import AppIcon from "./AppIcon.vue";

defineProps<{ title: string }>();
const open = ref(false);
const id = useId();
</script>

<template>
  <section class="progressive-history-item">
    <button :id="`${id}-trigger`" type="button" class="motion-disclosure-trigger"
      :aria-expanded="open" :aria-controls="`${id}-content`" @click="open = !open">
      <span>{{ title }}</span>
      <AppIcon class="motion-disclosure-chevron" name="chevron-down" :size="18" />
    </button>
    <MotionReveal :show="open">
      <div :id="`${id}-content`" role="region" :aria-labelledby="`${id}-trigger`"><slot /></div>
    </MotionReveal>
  </section>
</template>
