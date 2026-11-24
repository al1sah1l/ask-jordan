<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { api, friendlyError, type ReflectionLimits, type WorkResponse } from "../api/client";
import MotionReveal from "./MotionReveal.vue";
import AppIcon from "./AppIcon.vue";
import { freezeLeavingItem, restoreEnteringItem } from "../utils/motion";

const props = defineProps<{ storyId: string }>();
const emit = defineEmits<{ busy: [value: boolean] }>();
const text = ref("");
const images = ref<string[]>([]);
const ready = ref(false);
const busy = ref(false);
const saving = ref(false);
const error = ref("");
const saved = ref(false);
let savedTimer: ReturnType<typeof setTimeout> | undefined;
const fileInput = ref<HTMLInputElement | null>(null);
const limits = ref<ReflectionLimits>({
  maxImages: 3, maxImageBytes: 1048576, maxTextCharacters: 5000,
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"], requestBodyBytes: 5242880,
});
const hasContent = computed(() => Boolean(text.value.trim()) || images.value.length > 0);

function setBusy(value: boolean) {
  busy.value = value;
  emit("busy", value);
}

function applyWork(response: WorkResponse) {
  if (!response || !response.limits || !(response.entry === null || (
    typeof response.entry?.text === "string" && Array.isArray(response.entry.images)
  ))) throw new Error("Invalid saved work");
  limits.value = response.limits;
  text.value = response.entry?.text ?? "";
  images.value = [...(response.entry?.images ?? [])];
  ready.value = true;
}

async function load() {
  if (busy.value) return;
  setBusy(true);
  error.value = "";
  try {
    applyWork(await api.getReflection(props.storyId));
  } catch (err) {
    ready.value = false;
    error.value = friendlyError(err, "Couldn't load your work. Retry before making changes.");
  } finally {
    setBusy(false);
  }
}

function clearSaved() {
  if (savedTimer !== undefined) clearTimeout(savedTimer);
  savedTimer = undefined;
  saved.value = false;
}

function markEdited() { clearSaved(); }
onBeforeUnmount(clearSaved);

async function preparePhoto(file: File): Promise<string> {
  if (!limits.value.acceptedMimeTypes.includes(file.type)) {
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  }
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose a photo smaller than 20 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) {
      throw new Error("This photo is too large. Choose a smaller version.");
    }
    if (file.size <= limits.value.maxImageBytes) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Couldn't read this photo."));
        reader.onerror = () => reject(new Error("Couldn't read this photo."));
        reader.readAsDataURL(file);
      });
    }
    // Fit larger phone photos to the private upload limit without cropping.
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn't prepare this photo. Try a smaller file.");
    for (const edge of [1600, 1200, 900]) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/webp", 0.82);
      if (atob(data.slice(data.indexOf(",") + 1)).length <= limits.value.maxImageBytes) return data;
    }
    throw new Error("This photo is still too large. Choose a smaller version.");
  } catch (err) {
    if (err instanceof DOMException) throw new Error("Couldn't open this photo. Choose a valid JPEG, PNG, or WebP file.");
    throw err;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function addPhotos(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = "";
  if (!files.length || busy.value || !ready.value) return;
  error.value = "";
  if (images.value.length + files.length > limits.value.maxImages) {
    error.value = `Choose up to ${limits.value.maxImages} photos.`;
    return;
  }
  setBusy(true);
  try {
    const additions: string[] = [];
    for (const file of files) additions.push(await preparePhoto(file));
    images.value = [...images.value, ...additions];
    markEdited();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Couldn't add this photo. Try another file.";
  } finally {
    setBusy(false);
  }
}

function removePhoto(index: number) {
  if (busy.value) return;
  images.value = images.value.filter((_, i) => i !== index);
  markEdited();
}

async function save() {
  if (!ready.value || busy.value || saved.value || !hasContent.value) return;
  setBusy(true);
  error.value = "";
  clearSaved();
  saving.value = true;
  try {
    applyWork(await api.saveReflection(props.storyId, text.value.trim(), images.value));
    saved.value = true;
    savedTimer = setTimeout(() => {
      saved.value = false;
      savedTimer = undefined;
    }, 1800);
  } catch (err) {
    error.value = friendlyError(err, "Couldn't save your work. Your draft is still here; try again.");
  } finally {
    saving.value = false;
    setBusy(false);
  }
}

watch(() => props.storyId, () => {
  ready.value = false;
  text.value = "";
  images.value = [];
  clearSaved();
  void load();
}, { immediate: true });
</script>

<template>
  <section class="activity-work" aria-labelledby="work-heading" :aria-busy="busy">
    <h2 id="work-heading">Your work</h2>
    <p v-if="busy && !ready" role="status">Loading…</p>
    <MotionReveal :show="Boolean(error)">
    <div class="notification error" role="alert">
      <p>{{ error }}</p>
      <button v-if="!ready" class="button button-light" type="button" :disabled="busy" @click="load">Retry loading</button>
    </div>
    </MotionReveal>
    <MotionReveal :show="ready">
    <form @submit.prevent="save">
      <label for="work-reflection">Your reflection</label>
      <textarea id="work-reflection" v-model="text" rows="4" :maxlength="limits.maxTextCharacters" :disabled="busy" placeholder="What did you try? What did you notice, and why?" @input="markEdited"></textarea>

      <div class="work-photo-heading">
        <label for="work-photos">Photos (optional)</label>
        <span>Up to {{ limits.maxImages }}</span>
      </div>
      <input id="work-photos" ref="fileInput" type="file" multiple :accept="limits.acceptedMimeTypes.join(',')" :disabled="busy || images.length >= limits.maxImages" @change="addPhotos" />
      <TransitionGroup name="motion-list" tag="div" class="work-photos" @before-enter="restoreEnteringItem" @before-leave="freezeLeavingItem">
        <figure v-for="(photo, index) in images" :key="`${photo}:${index}`">
          <img :src="photo" :alt="`Your work, photo ${index + 1}`" />
          <button class="button button-light" type="button" :disabled="busy" :aria-label="`Remove photo ${index + 1}`" @click="removePhoto(index)">Remove</button>
        </figure>
      </TransitionGroup>
      <div class="work-actions">
        <button class="button" :class="saved ? 'button-saved' : 'button-primary'" type="submit" :disabled="busy || !hasContent || saved" aria-live="polite"><AppIcon v-if="saved" name="check" />{{ saving ? "Saving…" : saved ? "Saved" : "Save" }}</button>
      </div>
    </form>
    </MotionReveal>
  </section>
</template>
