
<script setup lang="ts">
import { ref, watch } from "vue";
import LegacyStoryReader from "./LegacyStoryReader.vue";
import ProgressiveStoryReader from "./ProgressiveStoryReader.vue";
import { api, ApiError, friendlyError } from "../api/client";

const props = defineProps<{ storyId: string; activityName: string }>();
const emit = defineEmits<{ back: []; busy: [value: boolean] }>();

type ReaderMode = "loading" | "legacy" | "progressive" | "error";

const mode = ref<ReaderMode>("loading");
const error = ref("");
const readerBusy = ref(false);

function setBusy(value: boolean) {
  readerBusy.value = value;
  emit("busy", value);
}

async function detectStory() {
  mode.value = "loading";
  error.value = "";
  setBusy(true);

  try {
    // A progressive story has its own read endpoint.
    await api.getProgressiveStory(props.storyId);
    mode.value = "progressive";
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // Not a progressive story: verify that the legacy story exists.
      try {
        await api.getStory(props.storyId);
        mode.value = "legacy";
      } catch (legacyError) {
        error.value = friendlyError(legacyError, "Couldn't load your story.");
        mode.value = "error";
      }
    } else {
      error.value = friendlyError(err, "Couldn't load your story.");
      mode.value = "error";
    }
  } finally {
    setBusy(false);
  }
}

watch(() => props.storyId, () => { void detectStory(); }, { immediate: true });
</script>

<template>
  <section v-if="mode === 'loading'" class="story-reader">
    <p class="story-loading" role="status">Loading your adventure...</p>
  </section>

  <section v-else-if="mode === 'error'" class="story-reader">
    <div class="notification error" role="alert">{{ error }}</div>
    <button class="button button-light" type="button" @click="detectStory">Retry loading</button>
    <button class="button button-light" type="button" @click="emit('back')">← Activities</button>
  </section>

  <ProgressiveStoryReader
    v-else-if="mode === 'progressive'"
    :story-id="storyId"
    :activity-name="activityName"
    @back="emit('back')"
    @busy="setBusy"
  />

  <LegacyStoryReader
    v-else
    :story-id="storyId"
    :activity-name="activityName"
    @back="emit('back')"
    @busy="setBusy"
  />
</template>
