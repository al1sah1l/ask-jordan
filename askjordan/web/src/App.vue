
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import StoryReader from "./components/StoryReader.vue";

import {
  api,
  ApiError,
  friendlyError,
  type Activity,
  type Preference,
  type Profile,
} from "./api/client";

type Screen = "auth" | "account-error" | "profile" | "activities" | "story";

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
const readerBusy = ref(false);
const navigationBusy = computed(() => loading.value || initializing.value || readerBusy.value);
const profileReturnScreen = ref<Screen>("activities");
const error = ref("");
const message = ref("");

const selectedStory = ref<string | null>(null);
const selectedActivityName = ref("");

// This map is reconstructed from MongoDB-backed API data.
const startedStories = ref<Record<string, string>>({});

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

async function authenticate(mode: "register" | "sign-in") {
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

    account.value = null;
    profile.value = null;

    username.value = "";
    password.value = "";
    profileName.value = "";
    profileAbout.value = "";

    activities.value = [];
    preferences.value = [];
    startedStories.value = {};

    selectedStory.value = null;
    selectedActivityName.value = "";
    search.value = "";

    screen.value = "auth";
  });
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
    const result = await api.currentUser();
    account.value = result.account;
    await loadProfileAndNavigate();
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.code === "INVALID_INPUT")) {
      account.value = null;
      profile.value = null;
      screen.value = "auth";
      if (err.status === 401) error.value = "Please sign in.";
    } else {
      screen.value = "account-error";
      error.value = friendlyError(err, "We couldn't load your account. Please try again.");
    }
  } finally {
    initializing.value = false;
  }
}

onMounted(restoreAccount);
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="/" :aria-disabled="navigationBusy" @click.prevent="goHome">
        <span class="brand-icon">✦</span>
        Ask Jordan
      </a>

      <div v-if="account" class="account-menu">
        <span>
          Hi, {{ profile?.name || account }}!
        </span>

        <button v-if="profile && screen !== 'profile'" class="button button-light" :disabled="navigationBusy" @click="editProfile">Profile</button>
        <button
          class="button button-light"
          :disabled="navigationBusy"
          @click="signOut"
        >
          Sign out
        </button>
      </div>
    </header>

    <main class="main-content">
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

      <section
        v-if="initializing"
        class="initial-loading"
      >
        <h2>Getting your adventure ready...</h2>
        <p>Just a moment!</p>
      </section>

      <section v-else-if="screen === 'account-error'" class="initial-loading">
        <h1>Let's reconnect to your account</h1>
        <p>Your saved profile and stories will be here when the connection returns.</p>
        <button class="button button-primary" :disabled="navigationBusy" @click="restoreAccount">Retry loading account</button>
      </section>

      <!-- LOGIN / REGISTER -->
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


        </div>

        <form
          class="auth-card"
          @submit.prevent="authenticate('sign-in')"
        >
          <h2>Welcome!</h2>



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

      <!-- PROFILE -->
      <section
        v-else-if="screen === 'profile'"
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
                : profile ? "Save profile" : "Let's explore! →"
            }}
          </button>
          <button v-if="profile" class="button button-light" type="button" :disabled="navigationBusy" @click="cancelProfile">Cancel</button>
        </form>

        <section v-if="profile && interestedActivities.length" class="profile-interests" aria-labelledby="your-interests">
          <h2 id="your-interests">Your Interests</h2>
          <ul class="interest-list">
            <li v-for="activity in interestedActivities" :key="activity.activity">
              <button class="interest-row" type="button" :disabled="navigationBusy" @click="openStory(activity)">
                <span class="interest-row-icon" aria-hidden="true">{{ activityEmoji(activity.name) }}</span>
                <span>{{ activity.name }}</span>
                <span class="interest-row-arrow" aria-hidden="true">→</span>
              </button>
            </li>
          </ul>
        </section>
      </section>

      <!-- ACTIVITIES -->
      <section
        v-else-if="screen === 'activities'"
        class="explore-page"
      >
        <h1>What are you curious about?</h1>

        <div class="search-bar">
          <span>⌕</span>

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

        <div class="activity-grid">
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
                {{
                  savedSubjects.has(activity.activity)
                    ? "✓ Interested"
                    : "+ I'm interested"
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
        @busy="readerBusy = $event"
      />
    </main>
  </div>
</template>
