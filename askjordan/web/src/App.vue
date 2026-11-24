
<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import StoryReader from "./components/StoryReader.vue";
import MotionReveal from "./components/MotionReveal.vue";
import { freezeLeavingItem, restoreEnteringItem } from "./utils/motion";
import { chapterProgress } from "./utils/storyProgress";
import AppIcon from "./components/AppIcon.vue";

import {
  api,
  ApiError,
  friendlyError,
  type Activity,
  type Preference,
  type Profile,
  type StorySummary,
} from "./api/client";

type Screen = "auth" | "account-error" | "profile" | "activities" | "story";
type AuthMode = "sign-in" | "register";

const screen = ref<Screen>("auth");

const account = ref<string | null>(null);
const profile = ref<Profile | null>(null);

const username = ref("");
const password = ref("");
const confirmPassword = ref("");
const authMode = ref<AuthMode>("sign-in");
const showDeleteAccount = ref(false);
const deletePassword = ref("");
const deleteConfirmation = ref("");
const deleteError = ref("");
const authForm = ref<HTMLFormElement | null>(null);
const authFormHeight = ref<number>();

// Measure the active form so adding confirmation or errors never snaps the card.
watch(authForm, (form, _previous, onCleanup) => {
  if (!form) return;
  const measure = () => { authFormHeight.value = form.offsetHeight; };
  const observer = new ResizeObserver(measure);
  observer.observe(form);
  measure();
  onCleanup(() => observer.disconnect());
}, { flush: "post" });

const profileName = ref("");
const profileAbout = ref("");

const activities = ref<Activity[]>([]);
const preferences = ref<Preference[]>([]);

const search = ref("");
const loading = ref(false);
const initializing = ref(true);
const readerBusy = ref(false);
const navigationBusy = computed(() => loading.value || initializing.value || readerBusy.value);
const profileReturnScreen = ref<Screen>("activities");
const error = ref("");
const message = ref("");

const selectedStory = ref<string | null>(null);
const selectedActivityName = ref("");

// This map is reconstructed from MongoDB-backed API data.
const startedStories = ref<Record<string, string>>({});
const interestProgress = ref<Record<string, { percent: number; description: string }>>({});
let progressRevision = 0;

const filteredActivities = computed(() =>
  activities.value.filter((activity) =>
    `${activity.name} ${activity.description}`
      .toLowerCase()
      .includes(search.value.toLowerCase()),
  ),
);

const savedSubjects = computed(
  () =>
    new Set(
      preferences.value
        .filter((preference) =>
          preference.status === "interested",
        )
        .map((preference) => preference.subject),
    ),
);

const interestedActivities = computed(() =>
  activities.value.filter((activity) => savedSubjects.value.has(activity.activity)),
);

function activityEmoji(name: string): string {
  if (name.includes("Photo")) return "📷";
  if (name.includes("Film")) return "🎬";
  if (name.includes("Writing")) return "✍️";
  if (name.includes("Music")) return "🎵";
  if (name.includes("Robot")) return "🤖";
  if (name.includes("Game")) return "🎮";
  if (name.includes("Sports")) return "⚽";
  return "✨";
}

async function run(action: () => Promise<void>) {
  if (loading.value) return;

  loading.value = true;
  error.value = "";
  message.value = "";

  try {
    await action();
  } catch (err) {
    error.value = friendlyError(err, "Something went wrong. Please try again.");
    if (err instanceof ApiError && err.status === 401) {
      account.value = null;
      profile.value = null;
      screen.value = "auth";
    }
  } finally {
    loading.value = false;
  }
}

async function loadCatalog() {
  const [
    activitiesResponse,
    preferencesResponse,
    storiesResponse,
  ] = await Promise.all([
    api.getActivities(),
    api.getPreferences(),
    api.getStories(),
  ]);

  activities.value = activitiesResponse.activities;
  preferences.value = preferencesResponse.preferences;

  startedStories.value = Object.fromEntries(
    storiesResponse.stories.map((story) => [
      story.activity,
      story.story,
    ]),
  );
  void loadInterestProgress(storiesResponse.stories);
}

async function loadInterestProgress(stories: StorySummary[]) {
  const revision = ++progressRevision;
  const user = account.value;
  const results = await Promise.allSettled(stories.filter(story => savedSubjects.value.has(story.activity))
    .map(async story => {
      if (story.format === "progressive") {
        const data = await api.getProgressiveStory(story.story);
        const latest = data.chapters.at(-1);
        const progress = chapterProgress(latest?.stage);
        return [story.activity, { percent: progress.percent, description: `Chapter ${latest?.position ?? 1}: ${progress.label}` }] as const;
      }
      const { chapters } = await api.getStory(story.story);
      return [story.activity, { percent: Math.min(100, Math.round(chapters.length / 3 * 100)), description: `${chapters.length} of 3 chapters` }] as const;
    }));
  if (revision !== progressRevision || account.value !== user) return;
  interestProgress.value = Object.fromEntries(results.flatMap(result => result.status === "fulfilled" ? [result.value] : []));
}

async function loadProfileAndNavigate() {
  try {
    const result = await api.getProfile();

    profile.value = result;
    profileName.value = result.name;
    profileAbout.value = result.about;

    await loadCatalog();
    screen.value = "activities";
  } catch (err) {
    if (
      err instanceof ApiError &&
      (err.code === "NOT_FOUND" || err.code === "NO_PROFILE")
    ) {
      profile.value = null;
      profileName.value = "";
      profileAbout.value = "";
      screen.value = "profile";
      return;
    }

    throw err;
  }
}

async function saveProfile() {
  await run(async () => {
    const name = profileName.value.trim();
    const about = profileAbout.value.trim();

    if (!name) {
      throw new ApiError("BLANK_NAME", 400, "Please enter a display name.");
    }

    const editing = Boolean(profile.value);
    const result = editing
      ? await api.updateProfile(name, about)
      : await api.createProfile(name, about);
    // Remember the successful mutation even if the next catalog read fails.
    profile.value = { profile: result.profile, name, about };
    profileName.value = name;
    profileAbout.value = about;
    if (!editing || profileReturnScreen.value === "activities") await loadCatalog();
    screen.value = editing ? profileReturnScreen.value : "activities";
    message.value = "Profile saved. New adventures will use these details.";
  });
}

function switchAuthMode(mode: AuthMode) {
  if (loading.value || authMode.value === mode) return;
  authMode.value = mode;
  password.value = "";
  confirmPassword.value = "";
  error.value = "";
  message.value = "";
}

async function authenticate(mode: AuthMode) {
  await run(async () => {
    if (mode === "register") {
      const problems: string[] = [];
      const name = username.value.trim();
      if (!name) {
        problems.push("Enter a username.");
      } else if (name.length < 3) {
        problems.push("Your username is too short. Use at least 3 characters.");
      } else if (name.length > 32) {
        problems.push("Your username is too long. Use no more than 32 characters.");
      } else if (!/^[A-Za-z0-9_-]+$/.test(name)) {
        problems.push("Your username contains unsupported characters. Use only letters, numbers, underscores, or hyphens.");
      }
      if (!password.value.length) {
        problems.push("Enter a password.");
      } else if (password.value.length < 8) {
        problems.push("Your password is too short. Use at least 8 characters.");
      } else if (password.value.length > 128) {
        problems.push("Your password is too long. Use no more than 128 characters.");
      } else if (!confirmPassword.value) {
        problems.push("Confirm your password.");
      } else if (password.value !== confirmPassword.value) {
        problems.push("Your passwords don't match. Enter the same password in both fields.");
      }
      if (problems.length) {
        throw new ApiError("INVALID_REQUEST", 400, problems.join(" "));
      }
    }

    const result =
      mode === "register"
        ? await api.register(
            username.value.trim(),
            password.value,
          )
        : await api.signIn(
            username.value.trim(),
            password.value,
          );

    account.value = result.account;
    password.value = "";
    confirmPassword.value = "";

    selectedStory.value = null;
    startedStories.value = {};
    interestProgress.value = {};
    progressRevision++;

    try {
      await loadProfileAndNavigate();
    } catch (err) {
      screen.value = "account-error";
      throw err;
    }
  });
}

async function signOut() {
  await run(async () => {
    await api.signOut();
    clearAccountState();
  });
}

function clearAccountState() {
    account.value = null;
    profile.value = null;

    username.value = "";
    password.value = "";
    confirmPassword.value = "";
    authMode.value = "sign-in";
    profileName.value = "";
    profileAbout.value = "";

    activities.value = [];
    preferences.value = [];
    startedStories.value = {};
    interestProgress.value = {};
    progressRevision++;

    selectedStory.value = null;
    selectedActivityName.value = "";
    search.value = "";

    screen.value = "auth";
    showDeleteAccount.value = false;
    deletePassword.value = "";
    deleteConfirmation.value = "";
    deleteError.value = "";
}

function toggleDeleteAccount() {
  if (loading.value) return;
  showDeleteAccount.value = !showDeleteAccount.value;
  deletePassword.value = "";
  deleteConfirmation.value = "";
  deleteError.value = "";
}

async function deleteAccount() {
  if (navigationBusy.value || !showDeleteAccount.value) return;
  loading.value = true;
  deleteError.value = "";
  try {
    await api.deleteAccount(deletePassword.value, deleteConfirmation.value);
    clearAccountState();
    error.value = "";
    message.value = "Your account has been deleted.";
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      clearAccountState();
      error.value = "Your session has ended. Please sign in again to manage your account.";
    } else {
      deleteError.value = friendlyError(err, "We couldn't finish deleting your account. Please try again.");
    }
  } finally {
    loading.value = false;
  }
}

async function saveInterest(activity: Activity) {
  await run(async () => {
    const removing = savedSubjects.value.has(activity.activity);
    await api.setPreference(
      activity.activity,
      removing ? "notInterested" : "interested",
    );

    const result = await api.getPreferences();
    preferences.value = result.preferences;

    message.value = removing ? "Interest removed." : "Interest saved.";
  });
}

async function openStory(activity: Activity) {
  await run(async () => {
    selectedActivityName.value = activity.name;

    const existing =
      startedStories.value[activity.activity];

    if (existing) {
      selectedStory.value = existing;
      screen.value = "story";
      return;
    }

    const result = await api.startStory(
      activity.activity,
    );

    startedStories.value = {
      ...startedStories.value,
      [activity.activity]: result.story,
    };

    selectedStory.value = result.story;
    screen.value = "story";
  });
}

async function backToActivities() {
  selectedStory.value = null;
  selectedActivityName.value = "";
  error.value = "";
  message.value = "";

  screen.value = "activities";

  await run(async () => {
    // Refresh the source of truth when returning
    // from the story reader.
    await loadCatalog();
  });
}

async function goHome() {
  if (navigationBusy.value) return;
  if (screen.value === "account-error") {
    returnToMainPage();
    return;
  }
  if (account.value && profile.value) {
    await backToActivities();
  } else {
    error.value = "";
    message.value = "";
    screen.value = account.value ? "profile" : "auth";
  }
}

function editProfile() {
  if (navigationBusy.value || !profile.value) return;
  profileReturnScreen.value = screen.value;
  profileName.value = profile.value.name;
  profileAbout.value = profile.value.about;
  error.value = "";
  message.value = "";
  screen.value = "profile";
  void api.getStories().then(({ stories }) => loadInterestProgress(stories)).catch(() => {});
}

function cancelProfile() {
  if (navigationBusy.value || !profile.value) return;
  profileName.value = profile.value.name;
  profileAbout.value = profile.value.about;
  error.value = "";
  screen.value = profileReturnScreen.value;
}

async function restoreAccount() {
  initializing.value = true;
  error.value = "";
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await api.currentUser();
        account.value = result.account;
        await loadProfileAndNavigate();
        break;
      } catch (err) {
        const temporary = err instanceof ApiError &&
          (err.status >= 500 || err.status === 0 || err.code === "INVALID_RESPONSE");
        if (!temporary || attempt === 1) throw err;
        // Read-only recovery tolerates a brief local server restart.
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.code === "INVALID_INPUT")) {
      account.value = null;
      profile.value = null;
      screen.value = "auth";
    } else {
      screen.value = "account-error";
      error.value = friendlyError(err, "We couldn't load your account. Please try again.");
    }
  } finally {
    initializing.value = false;
  }
}

function returnToMainPage() {
  if (navigationBusy.value) return;
  clearAccountState();
  error.value = "";
  message.value = "";
}

onMounted(restoreAccount);
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="/" :aria-disabled="navigationBusy" @click.prevent="goHome">
        <span class="brand-icon"><AppIcon name="sparkles" :size="27" /></span>
        Ask Jordan
      </a>

      <div v-if="account" class="account-menu">
        <span>
          Hi, {{ profile?.name || account }}!
        </span>

        <button v-if="profile && screen !== 'profile'" class="button button-light" :disabled="navigationBusy" @click="editProfile">Profile</button>
        <button
          class="sign-out-icon"
          aria-label="Sign out"
          title="Sign out"
          :disabled="navigationBusy"
          @click="signOut"
        >
          <AppIcon name="sign-out" :size="23" />
        </button>
      </div>
    </header>

    <main class="main-content">
      <MotionReveal :show="Boolean(error) && screen !== 'auth' && screen !== 'account-error'">
      <div
        class="notification error"
        role="alert"
      >
        {{ error }}
      </div>
      </MotionReveal>

      <MotionReveal :show="Boolean(message)">
      <div
        class="notification success"
        role="status"
      >
        {{ message }}
      </div>
      </MotionReveal>

      <Transition name="app-screen" mode="out-in" @before-enter="element => element.removeAttribute('inert')" @before-leave="element => element.setAttribute('inert', '')">
      <section
        v-if="initializing"
        key="loading"
        class="initial-loading"
      >
        <h2>Getting your adventure ready...</h2>
        <p>Just a moment!</p>
      </section>

      <section v-else-if="screen === 'account-error'" key="account-error" class="initial-loading">
        <h1>We couldn’t open Ask Jordan</h1>
        <p>We couldn’t load your profile and adventures right now. Check your connection, then try again.</p>
        <div class="recovery-actions">
          <button class="button button-primary" :disabled="navigationBusy" @click="restoreAccount">Try again</button>
          <a class="button button-light" href="/" @click.prevent="returnToMainPage">Back to main page</a>
        </div>
      </section>

      <!-- LOGIN / REGISTER -->
      <section
        v-else-if="screen === 'auth'"
        key="auth"
        class="welcome"
      >
        <div class="welcome-copy">
          <span class="eyebrow">
            YOUR JOURNEY STARTS HERE
          </span>

          <h1>
            Discover what
            <span>makes you curious.</span>
          </h1>


        </div>

        <div class="auth-card">
          <div
            class="auth-modes"
            :class="{ 'is-register': authMode === 'register' }"
            role="group"
            aria-label="Account access"
          >
            <button
              type="button"
              class="auth-mode"
              :aria-pressed="authMode === 'sign-in'"
              :disabled="loading"
              @click="switchAuthMode('sign-in')"
            >Sign in</button>
            <button
              type="button"
              class="auth-mode"
              :aria-pressed="authMode === 'register'"
              :disabled="loading"
              @click="switchAuthMode('register')"
            >Create account</button>
          </div>

          <div
            class="auth-form-stage"
            :class="{ 'is-register': authMode === 'register' }"
            :style="authFormHeight === undefined ? undefined : { height: `${authFormHeight}px` }"
          >
            <Transition name="auth-slide" @before-enter="element => element.removeAttribute('inert')" @before-leave="element => element.setAttribute('inert', '')">
              <form
                :key="authMode"
                ref="authForm"
                class="auth-form"
                :aria-label="authMode === 'register' ? 'Create account' : 'Sign in'"
                :novalidate="authMode === 'register'"
                @submit.prevent="authenticate(authMode)"
              >
                <MotionReveal :show="Boolean(error)">
                  <div class="notification error" role="alert">{{ error }}</div>
                </MotionReveal>

                <label for="username">Username</label>

                <input
                  id="username"
                  v-model="username"
                  autocomplete="username"
                  placeholder="Your username"
                  required
                />

                <label for="password">Password</label>

                <input
                  id="password"
                  v-model="password"
                  type="password"
                  :autocomplete="authMode === 'register' ? 'new-password' : 'current-password'"
                  placeholder="Your password"
                  required
                />

                <template v-if="authMode === 'register'">
                  <label for="confirm-password">Confirm password</label>
                  <input
                    id="confirm-password"
                    v-model="confirmPassword"
                    type="password"
                    autocomplete="new-password"
                    placeholder="Enter your password again"
                    required
                  />
                </template>

                <button
                  class="button button-primary"
                  type="submit"
                  :disabled="loading"
                >
                  {{ loading ? "Please wait..." : authMode === "register" ? "Create account" : "Sign in" }}
                </button>
              </form>
            </Transition>
          </div>
        </div>
      </section>

      <!-- PROFILE -->
      <section
        v-else-if="screen === 'profile'"
        key="profile"
        class="profile-page"
      >
        <h1>Your profile</h1>

        <form
          class="profile-card"
          @submit.prevent="saveProfile"
        >
          <label for="profile-name">
            Your Name
          </label>

          <input
            id="profile-name"
            v-model="profileName"
            placeholder="Your name"
            maxlength="80"
            required
          />

          <label for="profile-about">
            What's your life story? (optional)
          </label>

          <textarea
            id="profile-about"
            v-model="profileAbout"
            placeholder="I like soccer, music, drawing, movies..."
            rows="5"
            aria-describedby="profile-guidance"
          ></textarea>
          <p id="profile-guidance" class="profile-guidance">Saved changes apply only to new adventures.</p>

          <button
            class="button button-primary"
            type="submit"
            :disabled="loading || !profileName.trim()"
          >
            {{
              loading
                ? "Saving profile..."
                : profile ? "Save profile" : "Let's explore!"
            }}
            <AppIcon v-if="!loading && !profile" name="arrow-right" />
          </button>
          <button v-if="profile" class="button button-light" type="button" :disabled="navigationBusy" @click="cancelProfile">Cancel</button>
        </form>

        <section v-if="profile && interestedActivities.length" class="profile-interests" aria-labelledby="your-interests">
          <h2 id="your-interests">Your Interests</h2>
          <ul class="interest-list">
            <li v-for="activity in interestedActivities" :key="activity.activity">
              <button class="interest-row" type="button" :disabled="navigationBusy"
                :aria-label="interestProgress[activity.activity] ? `${activity.name}. ${interestProgress[activity.activity].description}` : activity.name"
                @click="openStory(activity)">
                <span class="interest-row-icon" aria-hidden="true">{{ activityEmoji(activity.name) }}</span>
                <span class="interest-row-body">
                  <span>{{ activity.name }}</span>
                  <span v-if="interestProgress[activity.activity]" class="interest-progress-track" aria-hidden="true"
                    :title="interestProgress[activity.activity].description">
                    <span :style="{ width: `${interestProgress[activity.activity].percent}%` }"></span>
                  </span>
                </span>
                <AppIcon class="interest-row-arrow" name="arrow-right" :size="23" />
              </button>
            </li>
          </ul>
        </section>
        <section v-if="account" class="account-danger" aria-label="Account deletion">
          <button v-if="!showDeleteAccount" class="button button-danger-outline" type="button"
            :disabled="navigationBusy" @click="toggleDeleteAccount">Delete account</button>
          <MotionReveal :show="showDeleteAccount">
            <form class="delete-account-form" @submit.prevent="deleteAccount">
              <MotionReveal :show="Boolean(deleteError)">
                <div class="notification error" role="alert">{{ deleteError }}</div>
              </MotionReveal>
              <label for="delete-confirmation">Type your username, <strong>{{ account }}</strong>, to confirm</label>
              <input id="delete-confirmation" v-model="deleteConfirmation" autocomplete="off" :disabled="loading" required />
              <label for="delete-password">Your password</label>
              <input id="delete-password" v-model="deletePassword" type="password" autocomplete="current-password" :disabled="loading" required />
              <div class="delete-account-actions">
                <button class="button button-light" type="button" :disabled="loading" @click="toggleDeleteAccount">Cancel</button>
                <button class="button button-primary" type="submit"
                  :disabled="navigationBusy || deleteConfirmation !== account || !deletePassword">
                  {{ loading ? "Deleting account…" : "Permanently delete account" }}
                </button>
              </div>
            </form>
          </MotionReveal>
        </section>
      </section>

      <!-- ACTIVITIES -->
      <section
        v-else-if="screen === 'activities'"
        key="activities"
        class="explore-page"
      >
        <h1>What are you curious about?</h1>

        <div class="search-bar">
          <AppIcon name="search" :size="23" />

          <input
            v-model="search"
            placeholder="Search activities..."
            aria-label="Search activities"
          />
        </div>

        <div class="section-heading">
          <h2>Explore</h2>
          <span aria-hidden="true">·</span>
          <span>{{ filteredActivities.length }} activities</span>
        </div>

        <TransitionGroup name="motion-list" tag="div" class="activity-grid" @before-enter="restoreEnteringItem" @before-leave="freezeLeavingItem">
          <article
            v-for="activity in filteredActivities"
            :key="activity.activity"
            class="activity-card"
          >
            <div class="activity-icon">
              {{ activityEmoji(activity.name) }}
            </div>

            <h3>{{ activity.name }}</h3>

            <p>{{ activity.description }}</p>

            <div class="activity-card-actions">
              <button
                class="button"
                :class="
                  savedSubjects.has(activity.activity)
                    ? 'button-saved'
                    : 'button-light'
                "
                :disabled="loading"
                :aria-pressed="savedSubjects.has(activity.activity)"
                @click="saveInterest(activity)"
              >
                <AppIcon :name="savedSubjects.has(activity.activity) ? 'check' : 'plus'" :size="18" />
                {{
                  savedSubjects.has(activity.activity)
                    ? "Interested"
                    : "I'm interested"
                }}
              </button>

              <button
                class="button button-primary"
                :disabled="loading"
                @click="openStory(activity)"
              >
                {{
                  loading
                    ? "Loading..."
                    : startedStories[activity.activity]
                      ? "Continue story"
                      : "Start adventure"
                }}
                <AppIcon v-if="!loading" name="arrow-right" />
              </button>
            </div>
          </article>
        </TransitionGroup>

        <p
          v-if="filteredActivities.length === 0"
          class="empty-state"
        >
          No activities found.
          Try a different search!
        </p>
      </section>

      <!-- STORY READER -->
      <div
        v-else-if="
          screen === 'story' &&
          selectedStory
        "
        :key="`story:${selectedStory}`"
      >
      <StoryReader
        :key="selectedStory"
        :story-id="selectedStory"
        :activity-name="selectedActivityName"
        @back="backToActivities"
        @busy="readerBusy = $event"
      />
      </div>
      </Transition>
    </main>
  </div>
</template>
