<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ActivityWork from "./ActivityWork.vue";
import MotionReveal from "./MotionReveal.vue";
import NarrativePassage from "./NarrativePassage.vue";
import AppIcon from "./AppIcon.vue";
import { api, friendlyError, type Chapter } from "../api/client";

const props = defineProps<{ storyId: string; activityName: string }>();
const emit = defineEmits<{ back: []; busy: [value: boolean] }>();
const chapters = ref<Chapter[]>([]);
const answer = ref("");
const loading = ref(false);
const workBusy = ref(false);
const navigationBusy = computed(() => loading.value || workBusy.value);
const error = ref("");
const notice = ref("");
const pendingRefresh = ref(false);
let pending: { count: number; confirmed: boolean } | null = null;
const latestChapter = computed(() => chapters.value.at(-1));
const isFinished = computed(() => chapters.value.length === 3);
const canContinue = computed(() => !pendingRefresh.value && !isFinished.value && Boolean(latestChapter.value?.question) && !latestChapter.value?.answer);

function activitySteps(text: string): string[] {
  return text.split(/\n+/).flatMap((line) =>
    line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
  ).map((step) => step.trim()).filter(Boolean);
}

function setBusy(value: boolean) {
  loading.value = value;
  emit("busy", navigationBusy.value);
}

function setWorkBusy(value: boolean) {
  workBusy.value = value;
  emit("busy", navigationBusy.value);
}

async function readSavedStory() {
  const response = await api.getStory(props.storyId);
  if (!Array.isArray(response.chapters) || !response.chapters.length) {
    throw new Error("Empty story");
  }
  chapters.value = response.chapters;
  if (pending) {
    if (response.chapters.length > pending.count) {
      answer.value = "";
      notice.value = "Your answer is saved. Your next chapter is ready.";
    } else if (pending.confirmed) {
      throw new Error("Waiting for saved chapter");
    } else {
      notice.value = "No new chapter is saved yet. Your draft is still here; you can try submitting again.";
    }
  }
  pending = null;
  pendingRefresh.value = false;
}

async function loadStory() {
  if (loading.value) return;
  setBusy(true);
  error.value = "";
  try {
    await readSavedStory();
  } catch (err) {
    error.value = friendlyError(err, "We couldn't load your saved story yet. Please retry loading.");
  } finally {
    setBusy(false);
  }
}

async function continueStory() {
  const cleaned = answer.value.trim();
  if (!cleaned || loading.value || !canContinue.value) return;
  setBusy(true);
  error.value = "";
  notice.value = "";
  pending = { count: chapters.value.length, confirmed: false };
  pendingRefresh.value = true;
  let submissionError: unknown;
  try {
    await api.continueStory(props.storyId, cleaned, latestChapter.value?.chapter);
    pending.confirmed = true;
  } catch (err) {
    submissionError = err;
  }
  try {
    // Always reconcile, including when the POST response was lost after saving.
    await readSavedStory();
    if (submissionError && answer.value) {
      error.value = friendlyError(submissionError, "We couldn't save your answer. Your draft is still here.");
    }
  } catch (err) {
    error.value = friendlyError(err, "We couldn't check your saved answer. Retry loading before continuing; your draft is safe.");
  } finally {
    setBusy(false);
  }
}

watch(() => props.storyId, () => {
  chapters.value = [];
  answer.value = "";
  notice.value = "";
  pending = null;
  pendingRefresh.value = false;
  void loadStory();
}, { immediate: true });
</script>

<template>
  <section class="story-reader">
    <button
      class="button button-light story-back"
      :disabled="navigationBusy"
      @click="emit('back')"
    >
      <AppIcon name="arrow-left" /> Activities
    </button>

    <div class="story-heading">
      <span class="eyebrow">
        NEW CHAPTER
      </span>

      <h1>{{ activityName }}</h1>

    </div>

    <div class="story-progress" role="status" aria-live="polite">
      <div class="story-progress-title">
        <strong>Progress</strong>
        <span>{{ chapters.length }} of 3 chapters</span>
      </div>

      <div class="story-progress-track" role="progressbar" aria-label="Story progress"
        :aria-valuenow="Math.round(chapters.length / 3 * 100)" aria-valuemin="0" aria-valuemax="100"
        :aria-valuetext="`${chapters.length} of 3 chapters`">
        <div class="story-progress-fill" :style="{ width: `${chapters.length / 3 * 100}%` }"></div>
      </div>
    </div>

    <p v-if="loading && !chapters.length" class="story-loading">
      Loading your adventure...
    </p>

    <MotionReveal :show="Boolean(error)">
    <div class="notification error" role="alert">
      <p>{{ error }}</p>
      <button class="button button-light" :disabled="navigationBusy" @click="loadStory">Retry loading story</button>
    </div>
    </MotionReveal>
    <MotionReveal :show="Boolean(notice)">
      <p class="notification success" role="status">{{ notice }}</p>
    </MotionReveal>
    <p v-if="loading && chapters.length" class="story-loading" role="status">Checking your saved adventure…</p>
    <p v-if="pendingRefresh" class="story-loading">Checking whether your answer was saved before you continue.</p>

    <TransitionGroup name="motion-list" tag="div" class="story-chapters">
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

        <NarrativePassage :text="chapter.text" />

        <div
          v-if="chapter.answer"
          class="story-previous-answer"
        >
          <strong>{{ chapter.question }}</strong>
          <p class="answer-label">Your saved answer</p>
          <p>{{ chapter.answer }}</p>
        </div>

        <div
          v-if="chapter.suggestedActivity"
          class="story-challenge"
        >
          <span class="story-challenge-icon" aria-hidden="true">⭐</span>

          <div>
            <h3>Your mini challenge!</h3>
            <ol class="challenge-steps">
              <li v-for="(step, index) in activitySteps(chapter.suggestedActivity)" :key="index">{{ step }}</li>
            </ol>
          </div>
        </div>
      </article>
    </TransitionGroup>

    <MotionReveal :show="canContinue">
    <form
      class="story-answer-card"
      @submit.prevent="continueStory"
    >
      <h2 id="current-question">{{ latestChapter?.question }}</h2>
      <fieldset v-if="latestChapter?.choices?.length" class="story-choices">
        <legend class="sr-only">Your answer</legend>
        <label v-for="choice in latestChapter.choices" :key="choice" class="story-choice">
          <input v-model="answer" type="radio" name="story-choice" :value="choice" :disabled="navigationBusy" />
          <span>{{ choice }}</span>
        </label>
      </fieldset>
      <label v-else for="story-answer" class="sr-only">Your answer</label>

      <textarea
        v-if="!latestChapter?.choices?.length"
        id="story-answer"
        aria-describedby="current-question"
        v-model="answer"
        rows="4"
        :disabled="navigationBusy"
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
            : "Continue"
        }}
        <AppIcon v-if="!loading" name="arrow-right" />
      </button>
    </form>
    </MotionReveal>

    <MotionReveal :show="isFinished">
    <ActivityWork :story-id="storyId" @busy="setWorkBusy" />

    <div
      class="story-complete-card"
    >
      <div class="story-complete-icon" aria-hidden="true">⭐</div>

      <h2>You reached the story ending!</h2>

<p>Jordan is proud of you!</p>

      <button
        class="button button-primary"
        :disabled="navigationBusy"
        @click="emit('back')"
      >
        Explore more activities <AppIcon name="arrow-right" />
      </button>
    </div>
    </MotionReveal>
  </section>
</template>
