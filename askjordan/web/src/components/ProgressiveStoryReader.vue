
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import MotionReveal from "./MotionReveal.vue";
import MotionDisclosure from "./MotionDisclosure.vue";
import NarrativePassage from "./NarrativePassage.vue";
import AppIcon from "./AppIcon.vue";
import { freezeLeavingItem, restoreEnteringItem } from "../utils/motion";
import { chapterProgress } from "../utils/storyProgress";
import {
  api, friendlyError,
  type ProgressiveChapter, type ProgressiveQuestion,
  type ProgressiveStoryResponse, type WorkEntry,
} from "../api/client";
import {
  DEFAULT_REFLECTION_LIMITS,
  prepareReflectionPhoto,
} from "../utils/prepareReflectionPhoto";

const props = defineProps<{ storyId: string; activityName: string }>();
const emit = defineEmits<{ back: []; busy: [value: boolean] }>();

const story = ref<ProgressiveStoryResponse | null>(null);
const answer = ref("");
const reflection = ref("");
const photos = ref<string[]>([]);
const savedEntries = ref<Record<string, WorkEntry>>({});
const loading = ref(false);
const error = ref("");
const notice = ref("");

const photoLimits = DEFAULT_REFLECTION_LIMITS;

// Image lightbox.
const photoDialog = ref<HTMLDialogElement | null>(null);
const enlargedPhoto = ref("");
const enlargedPhotoAlt = ref("");

const chapters = computed(() => story.value?.chapters ?? []);
const latest = computed<ProgressiveChapter | undefined>(() => chapters.value.at(-1));
const stage = computed(() => latest.value?.stage);
const progress = computed(() => chapterProgress(stage.value));
const learningOverview = computed(() => chapters.value[0]?.theory);
const learningSummary = computed(() => {
  const text = learningOverview.value?.explanation ?? "";
  return Array.from(new Intl.Segmenter("en", { granularity: "sentence" }).segment(text), item => item.segment.trim())
    .filter(Boolean).slice(0, 2).join(" ");
});

const currentQuestion = computed<ProgressiveQuestion | undefined>(() => {
  if (stage.value === "first-choice") return latest.value?.firstQuestion;
  if (stage.value === "second-choice") return latest.value?.secondQuestion;
  return undefined;
});

const canAnswer = computed(() => Boolean(answer.value.trim()) && !loading.value);
const canSaveReflection = computed(() =>
  (Boolean(reflection.value.trim()) || photos.value.length > 0) && !loading.value
);

function setBusy(value: boolean) {
  loading.value = value;
  emit("busy", value);
}

function savedEntry(chapterId: string): WorkEntry | undefined {
  return savedEntries.value[chapterId];
}

function openPhoto(photo: string, alt: string) {
  enlargedPhoto.value = photo;
  enlargedPhotoAlt.value = alt;
  photoDialog.value?.showModal();
}

function closePhoto() {
  photoDialog.value?.close();
}

function onDialogClick(event: MouseEvent) {
  if (event.target === event.currentTarget) closePhoto();
}

function onDialogClose() {
  enlargedPhoto.value = "";
  enlargedPhotoAlt.value = "";
}

async function refresh() {
  const storyId = props.storyId;
  const result = await api.getProgressiveStory(storyId);

  if (!Array.isArray(result.chapters) || !result.chapters.length) {
    throw new Error("Empty progressive story");
  }

  const oldChapter = latest.value;
  const newChapter = result.chapters.at(-1)!;
  const completed = result.chapters.filter(chapter => chapter.stage === "reflected");

  const entries = await Promise.all(completed.map(async chapter => {
    const response = await api.getProgressiveReflection(storyId, chapter.chapter);
    return [chapter.chapter, response.entry] as const;
  }));

  const nextSavedEntries: Record<string, WorkEntry> = {};

  for (const [chapterId, entry] of entries) {
    if (entry) nextSavedEntries[chapterId] = entry;
  }

  let nextReflection = "";
  let nextPhotos: string[] = [];

  if (newChapter.stage === "awaiting-reflection") {
    const response = await api.getProgressiveReflection(storyId, newChapter.chapter);
    nextReflection = response.entry?.text ?? "";
    nextPhotos = [...(response.entry?.images ?? [])];
  } else if (newChapter.stage === "reflected") {
    const entry = nextSavedEntries[newChapter.chapter];
    nextReflection = entry?.text ?? "";
    nextPhotos = [...(entry?.images ?? [])];
  }

  if (storyId !== props.storyId) return;

  savedEntries.value = nextSavedEntries;
  reflection.value = nextReflection;
  photos.value = nextPhotos;
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

    if (mutationError) {
      error.value = friendlyError(mutationError, "Couldn't confirm your answer was saved.");
    } else {
      notice.value = "Your decision has been saved.";
    }
  } catch (err) {
    error.value = friendlyError(err, "Couldn't reload your progress. Please retry loading before continuing.");
  } finally {
    setBusy(false);
  }
}

async function addPhotos(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = "";

  if (!files.length || loading.value || stage.value !== "awaiting-reflection") return;

  if (photos.value.length + files.length > photoLimits.maxImages) {
    error.value = `Choose up to ${photoLimits.maxImages} photos.`;
    return;
  }

  setBusy(true);
  error.value = "";
  notice.value = "";

  try {
    const additions: string[] = [];

    for (const file of files) {
      additions.push(await prepareReflectionPhoto(file, photoLimits));
    }

    photos.value = [...photos.value, ...additions];
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Couldn't add this photo. Try another file.";
  } finally {
    setBusy(false);
  }
}

function removePhoto(index: number) {
  if (loading.value || stage.value !== "awaiting-reflection") return;
  photos.value = photos.value.filter((_, i) => i !== index);
}

async function saveReflection() {
  const chapter = latest.value;

  if (!chapter || stage.value !== "awaiting-reflection" || !canSaveReflection.value) return;

  setBusy(true);
  error.value = "";
  notice.value = "";

  let mutationError: unknown;

  try {
    await api.saveProgressiveReflection(
      props.storyId,
      chapter.chapter,
      reflection.value.trim(),
      photos.value,
    );
  } catch (err) {
    mutationError = err;
  }

  try {
    await refresh();

    if (mutationError) {
      error.value = friendlyError(mutationError, "Couldn't confirm your reflection was saved.");
    } else {
      notice.value = "Reflection saved! Your next chapter is unlocked.";
    }
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

    if (mutationError) {
      error.value = friendlyError(mutationError, "Couldn't confirm your new chapter was saved.");
    } else {
      notice.value = "A new chapter is ready!";
    }
  } catch (err) {
    error.value = friendlyError(err, "Couldn't reload your next chapter. Please retry loading.");
  } finally {
    setBusy(false);
  }
}

watch(() => props.storyId, () => {
  closePhoto();
  story.value = null;
  answer.value = "";
  reflection.value = "";
  photos.value = [];
  savedEntries.value = {};
  error.value = "";
  notice.value = "";
  void load();
}, { immediate: true });
</script>

<template>
  <section class="story-reader progressive-reader" :aria-busy="loading">
    <button class="button button-light story-back" type="button" :disabled="loading" @click="emit('back')">
      <AppIcon name="arrow-left" /> Activities
    </button>

    <div class="story-heading">
      <span class="eyebrow">YOUR LEARNING ADVENTURE</span>
      <h1>{{ activityName }}</h1>
    </div>

    <MotionReveal :show="Boolean(error)">
    <div class="notification error" role="alert">
      {{ error }}
      <button class="button button-light" type="button" :disabled="loading" @click="load">
        Reload progress
      </button>
    </div>
    </MotionReveal>

    <MotionReveal :show="Boolean(notice)">
      <p class="notification success" role="status">{{ notice }}</p>
    </MotionReveal>
    <p v-if="loading" class="story-loading" role="status">Updating your adventure...</p>

    <div v-if="latest" class="story-progress">
      <div class="story-progress-title">
        <strong>Chapter {{ latest.position }}</strong>
        <span>{{ chapters.filter(chapter => chapter.stage === "reflected").length }} completed</span>
      </div>
      <div class="story-progress-track" role="progressbar" aria-label="Chapter progress"
        :aria-valuenow="progress.percent" aria-valuemin="0" aria-valuemax="100"
        :aria-valuetext="`Chapter ${latest.position}: ${progress.label}`">
        <div class="story-progress-fill" :style="{ width: `${progress.percent}%` }"></div>
      </div>
    </div>

    <section v-if="learningOverview" class="progressive-theory adventure-overview" aria-labelledby="learning-overview-heading">
      <h2 id="learning-overview-heading">What you'll learn</h2>
      <div class="progressive-terms" aria-label="Topics you'll explore">
        <span v-for="term in learningOverview.keyTerms" :key="term">{{ term }}</span>
      </div>
      <p>{{ learningSummary }}</p>
    </section>

    <section v-if="chapters.length > 1" class="progressive-history">
      <h2>Previous chapters</h2>

      <MotionDisclosure v-for="chapter in chapters.slice(0, -1)" :key="chapter.chapter"
        :title="`Chapter ${chapter.position}: ${chapter.theory.topic}`">

        <p>{{ chapter.theory.explanation }}</p>
        <p v-if="chapter.firstDecision"><strong>First choice:</strong> {{ chapter.firstDecision.answer }}</p>
        <p v-if="chapter.secondDecision"><strong>Second choice:</strong> {{ chapter.secondDecision.answer }}</p>
        <p v-if="chapter.conclusion">{{ chapter.conclusion }}</p>

        <div
          v-if="savedEntry(chapter.chapter) &&
                (savedEntry(chapter.chapter)!.text || savedEntry(chapter.chapter)!.images.length)"
          class="progressive-saved-reflection"
        >
          <h3>My reflection</h3>
          <p v-if="savedEntry(chapter.chapter)!.text">{{ savedEntry(chapter.chapter)!.text }}</p>

          <div v-if="savedEntry(chapter.chapter)!.images.length" class="work-photos progressive-photo-gallery">
            <figure v-for="(photo, index) in savedEntry(chapter.chapter)!.images" :key="index">
              <button
                type="button"
                class="progressive-photo-button"
                :aria-label="`Enlarge chapter ${chapter.position}, photo ${index + 1}`"
                @click="openPhoto(photo, `Chapter ${chapter.position}, photo ${index + 1}`)"
              >
                <img :src="photo" :alt="`Chapter ${chapter.position}, photo ${index + 1}`" />
                <span class="progressive-zoom-hint" aria-hidden="true">Enlarge</span>
              </button>
            </figure>
          </div>
        </div>
      </MotionDisclosure>
    </section>

    <template v-if="latest">
      <article :key="latest.chapter" class="story-chapter-card motion-content">
        <div class="chapter-label">
          <span class="chapter-number">{{ latest.position }}</span>
          <span>CHAPTER {{ latest.position }}</span>
        </div>

        <h2>{{ latest.theory.topic }}</h2>

        <h3 class="progressive-section-title">The story</h3>
        <NarrativePassage :text="latest.introduction" />

        <MotionReveal :show="Boolean(latest.firstDecision)">
        <div v-if="latest.firstDecision" class="story-previous-answer">
          <strong>{{ latest.firstDecision.question }}</strong>
          <p>Your choice: {{ latest.firstDecision.answer }}</p>
        </div>
        </MotionReveal>

        <MotionReveal :show="Boolean(latest.secondScene)">
          <h3 class="progressive-section-title">What happened next</h3>
          <NarrativePassage :text="latest.secondScene!" />
        </MotionReveal>

        <MotionReveal :show="Boolean(latest.secondDecision)">
        <div v-if="latest.secondDecision" class="story-previous-answer">
          <strong>{{ latest.secondDecision.question }}</strong>
          <p>Your choice: {{ latest.secondDecision.answer }}</p>
        </div>
        </MotionReveal>

        <MotionReveal :show="Boolean(latest.conclusion)">
          <h3 class="progressive-section-title">The outcome</h3>
          <NarrativePassage :text="latest.conclusion!" />
        </MotionReveal>

        <MotionReveal :show="Boolean(latest.practicalChallenge)">
        <div class="story-challenge">
          <span class="story-challenge-icon" aria-hidden="true">⭐</span>
          <div>
            <h3>Your mini challenge</h3>
            <ol class="challenge-steps">
              <li v-for="(step, index) in latest.practicalChallenge?.split(/\n+/).map(line => line.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean)" :key="index">{{ step }}</li>
            </ol>
          </div>
        </div>
        </MotionReveal>
      </article>

      <Transition name="app-screen" mode="out-in" @before-enter="element => element.removeAttribute('inert')" @before-leave="element => element.setAttribute('inert', '')">
      <form v-if="currentQuestion" :key="`${latest.chapter}:${stage}`" class="story-answer-card" @submit.prevent="submitChoice">
        <h2>{{ currentQuestion.prompt }}</h2>

        <fieldset v-if="currentQuestion.options?.length" class="story-choices">
          <legend class="sr-only">Choose your answer</legend>

          <label v-for="option in currentQuestion.options" :key="option" class="story-choice">
            <input v-model="answer" type="radio" :value="option" :disabled="loading" name="progressive-answer" />
            <span>{{ option }}</span>
          </label>
        </fieldset>

        <label v-else for="progressive-answer" class="sr-only">Your answer</label>
        <textarea
          v-if="!currentQuestion.options?.length"
          id="progressive-answer"
          v-model="answer"
          rows="3"
          maxlength="2000"
          :disabled="loading"
          placeholder="What would you do?"
        ></textarea>

        <button class="button button-primary" type="submit" :disabled="!canAnswer">
          {{ loading ? "Saving..." : "Make my choice" }}
          <AppIcon v-if="!loading" name="arrow-right" />
        </button>
      </form>
      </Transition>

      <MotionReveal :show="stage === 'awaiting-reflection'">
      <section class="activity-work">
        <h2>Your reflection</h2>
        <p>After trying the challenge, describe what you did and what you noticed. You can also share photos of your work.</p>

        <form @submit.prevent="saveReflection">
          <label for="progressive-reflection">What did you discover?</label>

          <textarea
            id="progressive-reflection"
            v-model="reflection"
            rows="5"
            :maxlength="photoLimits.maxTextCharacters"
            :disabled="loading"
            placeholder="I tried... I noticed... I would like to explore..."
          ></textarea>

          <div class="work-photo-heading">
            <label for="progressive-photos">Photos (optional)</label>
            <span>Up to {{ photoLimits.maxImages }}</span>
          </div>

          <input
            id="progressive-photos"
            type="file"
            multiple
            :accept="photoLimits.acceptedMimeTypes.join(',')"
            :disabled="loading || photos.length >= photoLimits.maxImages"
            @change="addPhotos"
          />

          <p class="progressive-caption">
            JPEG, PNG, or WebP. Large photos are compressed before saving.
          </p>

          <TransitionGroup name="motion-list" tag="div" class="work-photos progressive-photo-gallery" @before-enter="restoreEnteringItem" @before-leave="freezeLeavingItem">
            <figure v-for="(photo, index) in photos" :key="`${photo}:${index}`">
              <button
                type="button"
                class="progressive-photo-button"
                :aria-label="`Enlarge selected photo ${index + 1}`"
                @click="openPhoto(photo, `Selected reflection photo ${index + 1}`)"
              >
                <img :src="photo" :alt="`Your reflection, photo ${index + 1}`" />
                <span class="progressive-zoom-hint" aria-hidden="true">Enlarge</span>
              </button>

              <button
                class="button button-light"
                type="button"
                :disabled="loading"
                :aria-label="`Remove photo ${index + 1}`"
                @click="removePhoto(index)"
              >
                Remove
              </button>
            </figure>
          </TransitionGroup>

          <button class="button button-primary" type="submit" :disabled="!canSaveReflection">
            {{ loading ? "Saving..." : "Save reflection" }}
            <AppIcon v-if="!loading" name="check" />
          </button>
        </form>
      </section>
      </MotionReveal>

      <MotionReveal :show="stage === 'reflected'">
      <section class="story-complete-card">
        <div class="story-complete-icon" aria-hidden="true">⭐</div>
        <h2>Chapter complete!</h2>
        <p>Your reflection is saved. Ready to explore something new?</p>

        <div
          v-if="savedEntry(latest.chapter) &&
                (savedEntry(latest.chapter)!.text || savedEntry(latest.chapter)!.images.length)"
          class="progressive-saved-reflection"
        >
          <h3>My reflection</h3>
          <p v-if="savedEntry(latest.chapter)!.text">{{ savedEntry(latest.chapter)!.text }}</p>

          <div v-if="savedEntry(latest.chapter)!.images.length" class="work-photos progressive-photo-gallery">
            <figure v-for="(photo, index) in savedEntry(latest.chapter)!.images" :key="index">
              <button
                type="button"
                class="progressive-photo-button"
                :aria-label="`Enlarge chapter ${latest.position}, photo ${index + 1}`"
                @click="openPhoto(photo, `Chapter ${latest.position}, photo ${index + 1}`)"
              >
                <img :src="photo" :alt="`Chapter ${latest.position}, photo ${index + 1}`" />
                <span class="progressive-zoom-hint" aria-hidden="true">Enlarge</span>
              </button>
            </figure>
          </div>
        </div>

        <button class="button button-primary" type="button" :disabled="loading" @click="nextChapter">
          {{ loading ? "Creating chapter..." : "Start next chapter" }}
          <AppIcon v-if="!loading" name="arrow-right" />
        </button>
      </section>
      </MotionReveal>
    </template>

    <dialog
      ref="photoDialog"
      class="progressive-photo-dialog"
      aria-label="Enlarged reflection photo"
      @click="onDialogClick"
      @close="onDialogClose"
    >
      <div class="progressive-photo-dialog-content">
        <button
          type="button"
          class="progressive-photo-close"
          aria-label="Close enlarged photo"
          @click="closePhoto"
        >
          <AppIcon name="close" :size="22" />
        </button>

        <img v-if="enlargedPhoto" :src="enlargedPhoto" :alt="enlargedPhotoAlt" />
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.progressive-reader {
  padding-bottom: 60px;
}

.progressive-theory {
  padding: 24px;
  margin: 24px 0;
  border: 2px solid var(--aqua);
  border-radius: 18px;
  background: #e9f8f8;
}

.progressive-theory h3 {
  margin: 0 0 12px;
}

.progressive-theory p {
  color: #344861;
  line-height: 1.8;
}

.adventure-overview h2 { margin: 0; font-size: 21px; }
.adventure-overview .progressive-terms { margin-top: 12px; }
.adventure-overview p { margin: 14px 0 0; font-size: 15px; }

.progressive-terms {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.progressive-terms span {
  padding: 7px 12px;
  background: white;
  border-radius: 999px;
  color: var(--blue);
  font-size: 13px;
  font-weight: 800;
}

.progressive-section-title {
  margin: 28px 0 12px;
}

.progressive-history {
  margin-bottom: 26px;
}

.progressive-history h2 {
  margin-bottom: 14px;
}

.progressive-history-item {
  padding: 16px 20px;
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: white;
}

.progressive-history-item summary {
  cursor: pointer;
  font-weight: 800;
}

.progressive-history-item p {
  margin: 12px 0 0;
  line-height: 1.7;
}

.progressive-caption {
  color: var(--text-muted);
  font-size: 12px;
  margin-top: 12px;
}

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

.progressive-photo-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 14px;
}

.progressive-photo-gallery figure {
  margin: 0;
  max-width: 240px;
}

.progressive-photo-button {
  position: relative;
  display: block;
  padding: 0;
  width: 100%;
  border: 0;
  border-radius: 12px;
  background: transparent;
  overflow: hidden;
  cursor: zoom-in;
}

.progressive-photo-button img {
  display: block;
  max-width: 100%;
  height: auto;
  border-radius: 12px;
}

.progressive-photo-button:focus-visible {
  outline: 3px solid var(--blue);
  outline-offset: 3px;
}

.progressive-zoom-hint {
  position: absolute;
  right: 8px;
  bottom: 8px;
  padding: 5px 9px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.72);
  color: white;
  font-size: 12px;
  font-weight: 700;
}

.progressive-photo-dialog {
  position: fixed;
  inset: 0;
  width: fit-content;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  margin: auto;
  padding: 0;
  border: 0;
  border-radius: 16px;
  background: transparent;
  overflow: visible;
}

.progressive-photo-dialog::backdrop {
  background: rgba(10, 18, 35, 0.88);
}

.progressive-photo-dialog-content {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
}

.progressive-photo-dialog-content img {
  display: block;
  max-width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 12px;
}

.progressive-photo-close {
  position: absolute;
  z-index: 2;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.75);
  color: white;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
}

.progressive-photo-close:hover {
  background: black;
}

.progressive-photo-close:focus-visible {
  outline: 3px solid white;
  outline-offset: 3px;
}
</style>
