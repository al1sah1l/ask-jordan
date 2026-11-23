
<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  api,
  type Activity,
  type Preference,
} from "./api/client";

const account = ref<string | null>(null);

const username = ref("");
const password = ref("");

const activities = ref<Activity[]>([]);
const preferences = ref<Preference[]>([]);

const search = ref("");
const loading = ref(false);
const error = ref("");
const message = ref("");

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
        : "Something went wrong.";
  } finally {
    loading.value = false;
  }
}

async function loadCatalog() {
  const [activityResponse, preferenceResponse] =
    await Promise.all([
      api.getActivities(),
      api.getPreferences(),
    ]);

  activities.value = activityResponse.activities;
  preferences.value = preferenceResponse.preferences;
}

async function authenticate(
  mode: "register" | "sign-in",
) {
  await run(async () => {
    const result =
      mode === "register"
        ? await api.register(
            username.value,
            password.value,
          )
        : await api.signIn(
            username.value,
            password.value,
          );

    account.value = result.account;
    password.value = "";

    await loadCatalog();
  });
}

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

async function signOut() {
  await run(async () => {
    await api.signOut();

    account.value = null;
    activities.value = [];
    preferences.value = [];
    password.value = "";
  });
}

onMounted(async () => {
  try {
    const result = await api.currentUser();

    account.value = result.account;
    await loadCatalog();
  } catch {
    account.value = null;
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="site-header">
      <div class="brand">
        <span class="brand-icon">✦</span>
        Ask Jordan
      </div>

      <div v-if="account" class="account-menu">
        <span>Hi, {{ account }}!</span>
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
      <div v-if="error" class="notification error">
        {{ error }}
      </div>

      <div
        v-if="message"
        class="notification success"
      >
        {{ message }}
      </div>

      <section v-if="!account" class="welcome">
        <div class="welcome-copy">
          <span class="eyebrow">
            YOUR JOURNEY STARTS HERE
          </span>

          <h1>
            Discover what
            <span>makes you curious.</span>
          </h1>

          <p>
            Explore new activities, follow
            interactive stories, and discover
            interests you never knew you had.
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

          <label for="username">Username</label>
          <input
            id="username"
            v-model="username"
            required
            autocomplete="username"
            placeholder="Your username"
          />

          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            required
            type="password"
            autocomplete="current-password"
            placeholder="Your password"
          />

          <button
            class="button button-primary"
            type="submit"
            :disabled="loading"
          >
            Sign in
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

      <section v-else class="explore-page">
        <span class="eyebrow">
          EXPLORE YOUR POSSIBILITIES
        </span>

        <h1>What sparks your curiosity?</h1>

        <p class="page-description">
          Try something new. You might discover
          a passion you didn't know you had!
        </p>

        <div class="search-bar">
          <span>⌕</span>

          <input
            v-model="search"
            placeholder="Search activities..."
          />
        </div>

        <div class="section-heading">
          <h2>Activities to explore</h2>
          <span>
            {{ filteredActivities.length }}
            activities
          </span>
        </div>

        <div class="activity-grid">
          <article
            v-for="activity in filteredActivities"
            :key="activity.activity"
            class="activity-card"
          >
            <div class="activity-icon">
              ✨
            </div>

            <h3>{{ activity.name }}</h3>

            <p>{{ activity.description }}</p>

            <button
              class="button"
              :class="
                savedSubjects.has(activity.activity)
                  ? 'button-saved'
                  : 'button-primary'
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
    </main>
  </div>
</template>
