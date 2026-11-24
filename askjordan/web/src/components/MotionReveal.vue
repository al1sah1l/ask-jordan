<script setup lang="ts">
defineProps<{ show: boolean }>();
</script>

<template>
  <Transition name="motion-reveal" @before-enter="element => element.removeAttribute('inert')" @before-leave="element => element.setAttribute('inert', '')">
    <div v-if="show" class="motion-reveal">
      <div class="motion-reveal-inner"><slot /></div>
    </div>
  </Transition>
</template>
