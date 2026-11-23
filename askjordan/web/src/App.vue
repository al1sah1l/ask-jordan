
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import StoryReader from "./components/StoryReader.vue";

import {
  api,
  type Activity,
  type Preference,
  type Profile,
} from "./api/client";

type Screen = "auth" | "profile" | "activities" | "story";

// ------------------------------
// Application state
// ------------------------------

const screen = ref<Screen>("auth");

const account = ref<string | null>(null);
const profile = ref<Profile | null>(null);

const username = ref("");
const password = ref("");

const profileName = ref("");
const profileAbout = ref("");

const activities = ref<Activity[]>([]);
const preferences = ref<Preference[]>([]);

const search = ref("");

const loading = ref(false);
const initializing = ref(true);
const error = ref("");
const message = ref("");

// ------------------------------
// Story state
// ------------------------------

const selectedStory = ref<string | null>(null);
const selectedActivityName = ref("");

// Stories started during this frontend session.
// Persistent story recovery will be added later.
const startedStories = ref<Record<string, string>>({});

// ------------------------------
// Computed properties
// ------------------------------

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
      preferences.value.map(
        (preference) => preference.subject,
      ),
    ),
);

// ------------------------------
// Error and loading handling
// ------------------------------

async function run(action: () => Promise<void>) {
  if (loading.value) return;

  loading.value = true;
  error.value = "";
  message.value = "";

  try {
    await action();
  } catch (err) {
    error.value =
      err instanceof Error
        ? err.message
        : "Something went wrong. Please try again.";
  } finally {
    loading.value = false;
  }
}

// ------------------------------
// Catalog
// ------------------------------

async function loadCatalog() {
  const [activityResponse, preferenceResponse] =
    await Promise.all([
      api.getActivities(),
      api.getPreferences(),
    ]);

  activities.value = activityResponse.activities;
  preferences.value = preferenceResponse.preferences;
}

// ------------------------------
// Profile
// ------------------------------

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
      err instanceof Error &&
      (err.message === "NOT_FOUND" ||
        err.message === "NO_PROFILE")
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
      throw new Error("Please enter your name.");
    }

    await api.createProfile(name, about);

    profile.value = await api.getProfile();

    await loadCatalog();

    screen.value = "activities";

    message.value = "Your profile is ready! Let's explore!";
  });
}

// ------------------------------
// Authentication
// ------------------------------

async function authenticate(
  mode: "register" | "sign-in",
) {
  await run(async () => {
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

    selectedStory.value = null;
    startedStories.value = {};

    await loadProfileAndNavigate();
  });
}

async function signOut() {
  await run(async () => {
    await api.signOut();

    account.value = null;
    profile.value = null;

    username.value = "";
    password.value = "";
    profileName.value = "";
    profileAbout.value = "";

    activities.value = [];
    preferences.value = [];

    search.value = "";

    selectedStory.value = null;
    selectedActivityName.value = "";
    startedStories.value = {};

    screen.value = "auth";
  });
}

// ------------------------------
// Interests
// ------------------------------

async function saveInterest(activity: Activity) {
  await run(async () => {
    await api.setPreference(
      activity.activity,
      "interested",
    );

    const result = await api.getPreferences();
    preferences.value = result.preferences;

    message.value =
      `${activity.name} added to your interests!`;
  });
}

// ------------------------------
// Stories
// ------------------------------

async function openStory(activity: Activity) {
  await run(async () => {
    const existingStory =
      startedStories.value[activity.activity];

    selectedActivityName.value = activity.name;

    if (existingStory) {
      selectedStory.value = existingStory;
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

function backToActivities() {
  selectedStory.value = null;
  selectedActivityName.value = "";

  error.value = "";
  message.value = "";

  screen.value = "activities";
}

// ------------------------------
// Restore login session
// ------------------------------

onMounted(async () => {
  try {
    const result = await api.currentUser();

    account.value = result.account;

    await loadProfileAndNavigate();
  } catch (err) {
    if (!account.value) {
      screen.value = "auth";
    } else {
      error.value =
        err instanceof Error
          ? err.message
          : "Could not load your profile.";
    }
  } finally {
    initializing.value = false;
  }
});
</script>

<template>
  <div class="app-shell">
    <!-- HEADER -->
    <header class="site-header">
      <div class="brand">
        <span class="brand-icon">✦</span>
        Ask Jordan
      </div>

      <div
        v-if="account"
        class="account-menu"
      >
        <span>
          Hi, {{ profile?.name || account }}!
        </span>

        <button
          class="button button-light"
          :disabled="loading"
          @click="signOut"
        >
          Sign out
        </button>
      </div>
    </header>

    <main class="main-content">
      <!-- GLOBAL MESSAGES -->
      <div
        v-if="error"
        class="notification error"
        role="alert"
      >
        {{ error }}
      </div>

      <div
        v-if="message"
        class="notification success"
        role="status"
      >
        {{ message }}
      </div>

      <!-- INITIAL LOADING -->
      <section
        v-if="initializing"
        class="initial-loading"
      >
        <h2>Getting your adventure ready...</h2>
        <p>Just a moment!</p>
      </section>

      <!-- AUTHENTICATION SCREEN -->
      <section
        v-else-if="screen === 'auth'"
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

          <p>
            Explore new activities, follow interactive
            stories, and discover interests you never
            knew you had.
          </p>
        </div>

        <form
          class="auth-card"
          @submit.prevent="authenticate('sign-in')"
        >
          <h2>Welcome to Ask Jordan</h2>

          <p>
            Sign in or create an account
            to start exploring.
          </p>

          <label for="username">
            Username
          </label>

          <input
            id="username"
            v-model="username"
            autocomplete="username"
            placeholder="Your username"
            required
          />

          <label for="password">
            Password
          </label>

          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Your password"
            required
          />

          <button
            class="button button-primary"
            type="submit"
            :disabled="loading"
          >
            {{ loading ? "Please wait..." : "Sign in" }}
          </button>

          <button
            class="button button-light"
            type="button"
            :disabled="loading"
            @click="authenticate('register')"
          >
            Create account
          </button>
        </form>
      </section>

      <!-- PROFILE SCREEN -->
      <section
        v-else-if="screen === 'profile'"
        class="profile-page"
      >
        <span class="eyebrow">
          FIRST, LET'S GET TO KNOW YOU
        </span>

        <h1>
          Tell us a little about yourself!
        </h1>

        <p class="page-description">
          Your answers help us create adventures
          that feel personal to you.
          There are no right or wrong answers!
        </p>

        <form
          class="profile-card"
          @submit.prevent="saveProfile"
        >
          <label for="profile-name">
            What should we call you?
          </label>

          <input
            id="profile-name"
            v-model="profileName"
            placeholder="Your name"
            maxlength="80"
            required
          />

          <label for="profile-about">
            What do you enjoy doing?
          </label>

          <textarea
            id="profile-about"
            v-model="profileAbout"
            placeholder="I like soccer, music, drawing, movies..."
            rows="5"
          ></textarea>

          <button
            class="button button-primary"
            type="submit"
            :disabled="
              loading || !profileName.trim()
            "
          >
            {{
              loading
                ? "Saving profile..."
                : "Let's explore! →"
            }}
          </button>
        </form>
      </section>

      <!-- ACTIVITIES SCREEN -->
      <section
        v-else-if="screen === 'activities'"
        class="explore-page"
      >
        <span class="eyebrow">
          EXPLORE YOUR POSSIBILITIES
        </span>

        <h1>
          What sparks your curiosity?
        </h1>

        <p class="page-description">
          Try something new. You might discover
          a passion you didn't know you had!
        </p>

        <!-- SEARCH -->
        <div class="search-bar">
          <span>⌕</span>

          <input
            v-model="search"
            placeholder="Search activities..."
            aria-label="Search activities"
          />
        </div>

        <div class="section-heading">
          <h2>
            Activities to explore
          </h2>

          <span>
            {{ filteredActivities.length }}
            activities
          </span>
        </div>

        <!-- ACTIVITY CARDS -->
        <div class="activity-grid">
          <article
            v-for="activity in filteredActivities"
            :key="activity.activity"
            class="activity-card"
          >
            <div class="activity-icon">
              {{
                activity.name.includes("Photo")
                  ? "📷"
                  : activity.name.includes("Film")
                    ? "🎬"
                    : activity.name.includes("Writing")
                      ? "✍️"
                      : activity.name.includes("Music")
                        ? "🎵"
                        : activity.name.includes("Robot")
                          ? "🤖"
                          : activity.name.includes("Game")
                            ? "🎮"
                            : activity.name.includes("Sports")
                              ? "⚽"
                              : "✨"
              }}
            </div>

            <h3>
              {{ activity.name }}
            </h3>

            <p>
              {{ activity.description }}
            </p>

            <div class="activity-card-actions">
              <!-- SAVE INTEREST -->
              <button
                class="button"
                :class="
                  savedSubjects.has(activity.activity)
                    ? 'button-saved'
                    : 'button-light'
                "
                :disabled="
                  loading ||
                  savedSubjects.has(activity.activity)
                "
                @click="saveInterest(activity)"
              >
                {{
                  savedSubjects.has(activity.activity)
                    ? "✓ Interested"
                    : "+ I'm interested"
                }}
              </button>

              <!-- START STORY -->
              <button
                class="button button-primary"
                :disabled="loading"
                @click="openStory(activity)"
              >
                {{
                  startedStories[activity.activity]
                    ? "Continue story →"
                    : "Start adventure →"
                }}
              </button>
            </div>
          </article>
        </div>

        <p
          v-if="filteredActivities.length === 0"
          class="empty-state"
        >
          No activities found.
          Try a different search!
        </p>
      </section>

      <!-- STORY READER -->
      <StoryReader
        v-else-if="
          screen === 'story' &&
          selectedStory
        "
        :story-id="selectedStory"
        :activity-name="selectedActivityName"
        @back="backToActivities"
      />
    </main>
  </div>
</template>
