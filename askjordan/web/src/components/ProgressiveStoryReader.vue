
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { api, friendlyError, type ProgressiveChapter, type ProgressiveQuestion, type ProgressiveStoryResponse } from "../api/client";

const props = defineProps<{ storyId: string; activityName: string }>();
const emit = defineEmits<{ back: []; busy: [value: boolean] }>();

const story = ref<ProgressiveStoryResponse | null>(null);
const answer = ref("");
const reflection = ref("");
const savedReflections = ref<Record<string, string>>({});
const loading = ref(false);
const error = ref("");
const notice = ref("");

const chapters = computed(() => story.value?.chapters ?? []);
const latest = computed<ProgressiveChapter | undefined>(() => chapters.value.at(-1));
const stage = computed(() => latest.value?.stage);

const currentQuestion = computed<ProgressiveQuestion | undefined>(() => {
  if (stage.value === "first-choice") return latest.value?.firstQuestion;
  if (stage.value === "second-choice") return latest.value?.secondQuestion;
  return undefined;
});

const canAnswer = computed(() => Boolean(answer.value.trim()) && !loading.value);
const canSaveReflection = computed(() => Boolean(reflection.value.trim()) && !loading.value);

function setBusy(value: boolean) {
  loading.value = value;
  emit("busy", value);
}


async function refresh() {
  const result = await api.getProgressiveStory(props.storyId);

  if (!Array.isArray(result.chapters) || !result.chapters.length) {
    throw new Error("Empty progressive story");
  }

  const oldChapter = latest.value;
  const newChapter = result.chapters.at(-1)!;

  const completed = result.chapters.filter(chapter => chapter.stage === "reflected");

  const entries = await Promise.all(completed.map(async chapter => {
    const response = await api.getProgressiveReflection(props.storyId, chapter.chapter);
    return [chapter.chapter, response.entry?.text ?? ""] as const;
  }));

  const reflections = Object.fromEntries(entries);

  if (newChapter.stage === "awaiting-reflection") {
    const response = await api.getProgressiveReflection(props.storyId, newChapter.chapter);
    reflection.value = response.entry?.text ?? "";
  } else if (newChapter.stage === "reflected") {
    reflection.value = reflections[newChapter.chapter] ?? "";
  } else {
    reflection.value = "";
  }

  savedReflections.value = reflections;
  story.value = result;

  if (!oldChapter || oldChapter.chapter !== newChapter.chapter ||
      oldChapter.stage !== newChapter.stage) {
    answer.value = "";
  }
}

async function load() {
  if (loading.value) return;
  setBusy(true);
  error.value = "";

  try {
    await refresh();
  } catch (err) {
    error.value = friendlyError(err, "Couldn't load your saved adventure. Please retry.");
  } finally {
    setBusy(false);
  }
}

async function submitChoice() {
  const chapter = latest.value;
  const currentStage = stage.value;
  const cleaned = answer.value.trim();

  if (!chapter || !cleaned || loading.value ||
      (currentStage !== "first-choice" && currentStage !== "second-choice")) return;

  setBusy(true);
  error.value = "";
  notice.value = "";

  let mutationError: unknown;

  try {
    await api.submitProgressiveChoice(props.storyId, chapter.chapter, cleaned, currentStage);
  } catch (err) {
    mutationError = err;
  }

  try {
    await refresh();
    if (mutationError) error.value = friendlyError(mutationError, "Couldn't confirm your answer was saved.");
    else notice.value = "Your decision has been saved.";
  } catch (err) {
    error.value = friendlyError(err, "Couldn't reload your progress. Please retry loading before continuing.");
  } finally {
    setBusy(false);
  }
}

async function saveReflection() {
  const chapter = latest.value;
  if (!chapter || stage.value !== "awaiting-reflection" || !canSaveReflection.value) return;

  setBusy(true);
  error.value = "";
  notice.value = "";

  let mutationError: unknown;

  try {
    await api.saveProgressiveReflection(props.storyId, chapter.chapter, reflection.value.trim(), []);
  } catch (err) {
    mutationError = err;
  }

  try {
    await refresh();
    if (mutationError) error.value = friendlyError(mutationError, "Couldn't confirm your reflection was saved.");
    else notice.value = "Reflection saved! Your next chapter is unlocked.";
  } catch (err) {
    error.value = friendlyError(err, "Couldn't reload your reflection status. Please retry loading.");
  } finally {
    setBusy(false);
  }
}

async function nextChapter() {
  const chapter = latest.value;
  if (!chapter || stage.value !== "reflected" || loading.value) return;

  setBusy(true);
  error.value = "";
  notice.value = "";

  let mutationError: unknown;

  try {
    await api.nextProgressiveChapter(props.storyId, chapter.chapter);
  } catch (err) {
    mutationError = err;
  }

  try {
    await refresh();
    if (mutationError) error.value = friendlyError(mutationError, "Couldn't confirm your new chapter was saved.");
    else notice.value = "A new chapter is ready!";
    reflection.value = "";
  } catch (err) {
    error.value = friendlyError(err, "Couldn't reload your next chapter. Please retry loading.");
  } finally {
    setBusy(false);
  }
}

watch(() => props.storyId, () => {
  story.value = null;
  answer.value = "";
  reflection.value = "";
  error.value = "";
  notice.value = "";
  void load();
  savedReflections.value = {};
}, { immediate: true });
</script>

<template>
  <section class="story-reader progressive-reader" :aria-busy="loading">
    <button class="button button-light story-back" type="button" :disabled="loading" @click="emit('back')">← Activities</button>

    <div class="story-heading">
      <span class="eyebrow">YOUR LEARNING ADVENTURE</span>
      <h1>{{ activityName }}</h1>
      <p>Explore, make decisions, try something new, and reflect.</p>
    </div>

    <div v-if="error" class="notification error" role="alert">
      {{ error }}
      <button class="button button-light" type="button" :disabled="loading" @click="load">Reload progress</button>
    </div>

    <p v-if="notice" class="notification success" role="status">{{ notice }}</p>
    <p v-if="loading" class="story-loading" role="status">Updating your adventure...</p>

    <div v-if="latest" class="story-progress">
      <div class="story-progress-title">
        <strong>Chapter {{ latest.position }}</strong>
        <span>{{ chapters.filter(chapter => chapter.stage === "reflected").length }} completed</span>
      </div>
      <p class="progressive-step-label">
        {{ stage === "first-choice" ? "First decision" :
           stage === "second-choice" ? "Second decision" :
           stage === "awaiting-reflection" ? "Your mini challenge" : "Chapter complete" }}
      </p>
    </div>

    <section v-if="chapters.length > 1" class="progressive-history">
      <h2>Previous chapters</h2>
      <details v-for="chapter in chapters.slice(0, -1)" :key="chapter.chapter" class="progressive-history-item">
        <summary>Chapter {{ chapter.position }}: {{ chapter.theory.topic }} ✓</summary>
        <p>{{ chapter.theory.explanation }}</p>
        <p v-if="chapter.firstDecision"><strong>First choice:</strong> {{ chapter.firstDecision.answer }}</p>
        <p v-if="chapter.secondDecision"><strong>Second choice:</strong> {{ chapter.secondDecision.answer }}</p>
        <p v-if="chapter.conclusion">{{ chapter.conclusion }}</p>

        <div v-if="savedReflections[chapter.chapter]" class="progressive-saved-reflection">
            <h3>My reflection</h3>
            <p>{{ savedReflections[chapter.chapter] }}</p>
        </div>
      </details>
    </section>

    <template v-if="latest">
      <article class="story-chapter-card">
        <div class="chapter-label">
          <span class="chapter-number">{{ latest.position }}</span>
          <span>CHAPTER {{ latest.position }}</span>
        </div>

        <h2>{{ latest.theory.topic }}</h2>

        <div class="progressive-theory">
          <h3>What you'll learn</h3>
          <p>{{ latest.theory.explanation }}</p>
          <div class="progressive-terms">
            <span v-for="term in latest.theory.keyTerms" :key="term">{{ term }}</span>
          </div>
        </div>

        <h3 class="progressive-section-title">The story</h3>
        <p class="chapter-narrative">{{ latest.introduction }}</p>

        <div v-if="latest.firstDecision" class="story-previous-answer">
          <strong>{{ latest.firstDecision.question }}</strong>
          <p>Your choice: {{ latest.firstDecision.answer }}</p>
        </div>

        <template v-if="latest.secondScene">
          <h3 class="progressive-section-title">What happened next</h3>
          <p class="chapter-narrative">{{ latest.secondScene }}</p>
        </template>

        <div v-if="latest.secondDecision" class="story-previous-answer">
          <strong>{{ latest.secondDecision.question }}</strong>
          <p>Your choice: {{ latest.secondDecision.answer }}</p>
        </div>

        <template v-if="latest.conclusion">
          <h3 class="progressive-section-title">The outcome</h3>
          <p class="chapter-narrative">{{ latest.conclusion }}</p>
        </template>

        <div v-if="latest.practicalChallenge" class="story-challenge">
          <span class="story-challenge-icon" aria-hidden="true">★</span>
          <div>
            <h3>Your mini challenge</h3>
            <p>{{ latest.practicalChallenge }}</p>
          </div>
        </div>
      </article>

      <form v-if="currentQuestion" class="story-answer-card" @submit.prevent="submitChoice">
        <h2>{{ currentQuestion.prompt }}</h2>

        <fieldset v-if="currentQuestion.options?.length" class="story-choices">
          <legend class="sr-only">Choose your answer</legend>
          <label v-for="option in currentQuestion.options" :key="option" class="story-choice">
            <input v-model="answer" type="radio" :value="option" :disabled="loading" name="progressive-answer" />
            <span>{{ option }}</span>
          </label>
        </fieldset>

        <label v-else for="progressive-answer" class="sr-only">Your answer</label>
        <textarea v-if="!currentQuestion.options?.length" id="progressive-answer" v-model="answer" rows="3" maxlength="2000" :disabled="loading" placeholder="What would you do?"></textarea>

        <button class="button button-primary" type="submit" :disabled="!canAnswer">
          {{ loading ? "Saving..." : "Make my choice →" }}
        </button>
      </form>

      <section v-if="stage === 'awaiting-reflection'" class="activity-work">
        <h2>Your reflection</h2>
        <p>After trying the challenge, describe what you did and what you noticed.</p>
        <form @submit.prevent="saveReflection">
          <label for="progressive-reflection">What did you discover?</label>
          <textarea id="progressive-reflection" v-model="reflection" rows="5" maxlength="5000" :disabled="loading" placeholder="I tried... I noticed... I would like to explore..."></textarea>
          <button class="button button-primary" type="submit" :disabled="!canSaveReflection">
            {{ loading ? "Saving..." : "Save reflection ✓" }}
          </button>
        </form>
        <p class="progressive-caption">Photos will be available in a later update.</p>
      </section>

      <section v-if="stage === 'reflected'" class="story-complete-card">
        <div class="story-complete-icon">★</div>
        <h2>Chapter complete!</h2>
        <p>Your reflection is saved. Ready to explore something new?</p>
        <div v-if="savedReflections[latest.chapter]" class="progressive-saved-reflection">
            <h3>My reflection</h3>
            <p>{{ savedReflections[latest.chapter] }}</p>
        </div>
        <button class="button button-primary" type="button" :disabled="loading" @click="nextChapter">
          {{ loading ? "Creating chapter..." : "Start next chapter →" }}
        </button>
      </section>
    </template>
  </section>
</template>

<style scoped>
.progressive-reader { padding-bottom: 60px; }
.progressive-step-label { margin: 8px 0 0; color: var(--text-muted); font-size: 14px; font-weight: 700; }
.progressive-theory { padding: 24px; margin: 24px 0; border: 2px solid var(--aqua); border-radius: 18px; background: #e9f8f8; }
.progressive-theory h3 { margin: 0 0 12px; }
.progressive-theory p { color: #344861; line-height: 1.8; }
.progressive-terms { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px; }
.progressive-terms span { padding: 7px 12px; background: white; border-radius: 999px; color: var(--blue); font-size: 13px; font-weight: 800; }
.progressive-section-title { margin: 28px 0 12px; }
.progressive-history { margin-bottom: 26px; }
.progressive-history h2 { margin-bottom: 14px; }
.progressive-history-item { padding: 16px 20px; margin-bottom: 10px; border: 1px solid var(--border); border-radius: 14px; background: white; }
.progressive-history-item summary { cursor: pointer; font-weight: 800; }
.progressive-history-item p { margin: 12px 0 0; line-height: 1.7; }
.progressive-caption { color: var(--text-muted); font-size: 12px; margin-top: 12px; }

.progressive-saved-reflection {
  margin-top: 18px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: #f5f8ff;
  text-align: left;
}

.progressive-saved-reflection h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.progressive-saved-reflection p {
  margin: 0;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

</style>
