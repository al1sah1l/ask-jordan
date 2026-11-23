
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api, type Chapter } from "../api/client";

const props = defineProps<{
  storyId: string;
  activityName: string;
}>();

const emit = defineEmits<{
  back: [];
}>();

const chapters = ref<Chapter[]>([]);
const answer = ref("");
const loading = ref(false);
const error = ref("");

const latestChapter = computed(() =>
  chapters.value.at(-1),
);

const isFinished = computed(
  () => chapters.value.length === 3,
);

const canContinue = computed(() =>
  !isFinished.value &&
  Boolean(latestChapter.value?.question) &&
  !latestChapter.value?.answer,
);

async function loadStory() {
  loading.value = true;
  error.value = "";

  try {
    const response = await api.getStory(props.storyId);
    chapters.value = response.chapters;
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Could not load the story.";
  } finally {
    loading.value = false;
  }
}

async function continueStory() {
  const cleaned = answer.value.trim();

  if (!cleaned || loading.value) return;

  loading.value = true;
  error.value = "";

  try {
    await api.continueStory(
      props.storyId,
      cleaned,
    );

    const response = await api.getStory(props.storyId);
    chapters.value = response.chapters;
    answer.value = "";
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Could not continue the story.";
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.storyId,
  () => {
    chapters.value = [];
    answer.value = "";
    void loadStory();
  },
  { immediate: true },
);
</script>

<template>
  <section class="story-reader">
    <button
      class="button button-light story-back"
      @click="emit('back')"
    >
      ← Back to activities
    </button>

    <div class="story-heading">
      <span class="eyebrow">
        YOUR INTERACTIVE ADVENTURE
      </span>

      <h1>{{ activityName }}</h1>

      <p>
        Every choice is part of your journey.
        Read, imagine, and explore!
      </p>
    </div>

    <div class="story-progress">
      <div class="story-progress-title">
        <strong>Your adventure</strong>
        <span>{{ chapters.length }} of 3 chapters</span>
      </div>

      <div class="story-progress-steps">
        <div
          v-for="step in 3"
          :key="step"
          class="story-progress-step"
          :class="{
            completed: step <= chapters.length,
          }"
        ></div>
      </div>
    </div>

    <p v-if="loading && !chapters.length" class="story-loading">
      Loading your adventure...
    </p>

    <div v-if="error" class="notification error">
      {{ error }}
    </div>

    <div class="story-chapters">
      <article
        v-for="chapter in chapters"
        :key="chapter.position"
        class="story-chapter-card"
      >
        <div class="chapter-label">
          <span class="chapter-number">
            {{ chapter.position }}
          </span>

          <span>CHAPTER {{ chapter.position }}</span>
        </div>

        <h2>
          {{
            chapter.position === 1
              ? "The beginning"
              : chapter.position === 2
                ? "A new discovery"
                : "Your next adventure"
          }}
        </h2>

        <p class="chapter-narrative">
          {{ chapter.text }}
        </p>

        <div
          v-if="chapter.answer"
          class="story-previous-answer"
        >
          <strong>Your choice</strong>
          <p>{{ chapter.answer }}</p>
        </div>

        <div
          v-if="chapter.suggestedActivity"
          class="story-challenge"
        >
          <span class="story-challenge-icon">★</span>

          <div>
            <h3>Your mini challenge!</h3>
            <p>{{ chapter.suggestedActivity }}</p>
          </div>
        </div>
      </article>
    </div>

    <form
      v-if="canContinue"
      class="story-answer-card"
      @submit.prevent="continueStory"
    >
      <span class="eyebrow">
        WHAT WOULD YOU DO?
      </span>

      <h2>{{ latestChapter?.question }}</h2>

      <textarea
        v-model="answer"
        rows="4"
        placeholder="Write your answer here..."
        :disabled="loading"
        required
      ></textarea>

      <button
        class="button button-primary"
        type="submit"
        :disabled="loading || !answer.trim()"
      >
        {{
          loading
            ? "Creating your next chapter..."
            : "Continue adventure →"
        }}
      </button>
    </form>

    <div
      v-if="isFinished"
      class="story-complete-card"
    >
      <div class="story-complete-icon">★</div>

      <h2>Adventure complete!</h2>

      <p>
        You explored something new today.
        That's something to be proud of!
      </p>

      <p class="story-complete-note">
        Your story is finished. The reflection
        and exploration-completion steps will
        be connected next.
      </p>

      <button
        class="button button-primary"
        @click="emit('back')"
      >
        Explore more activities →
      </button>
    </div>
  </section>
</template>
