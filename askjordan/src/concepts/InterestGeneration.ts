
import type {
  ActivityRow,
  ConnectionRow,
  PreferenceRow,
} from "./InterestCollection.ts";

import type {
  InterestCandidate,
  InterestGenerationInput,
  InterestGenerator,
} from "../ai/InterestGenerator.ts";

import { OpenAIInterestGenerator } from "../ai/OpenAIInterestGenerator.ts";

export class NoActivitiesAvailable extends Error {}
export class SuggestionNotFound extends Error {}

export type SuggestionStatus = "pending" | "dismissed";

export type SuggestionRow = {
  suggestion: string;
  user: string;
  activity: string;
  status: SuggestionStatus;
};

export class InterestGenerationConcept {
  private readonly suggestions = new Map<string, SuggestionRow>();

  // Used to prevent older overlapping requests from overwriting newer ones.
  private readonly revisions = new Map<string, number>();

  constructor(
    private readonly freshID: () => string = () => crypto.randomUUID(),
    private readonly generator: InterestGenerator =
      new OpenAIInterestGenerator(),
  ) {}

  async generateSuggestions({
    user,
    preferences,
    activities,
    connections,
    startedActivities,
  }: {
    user: string;
    preferences: PreferenceRow[];
    activities: ActivityRow[];
    connections: ConnectionRow[];
    startedActivities: string[];
  }): Promise<{ suggestions: string[] }> {
    if (activities.length === 0) {
      throw new NoActivitiesAvailable(
        "No activities are available for suggestions.",
      );
    }

    const revision = (this.revisions.get(user) ?? 0) + 1;
    this.revisions.set(user, revision);

    const started = new Set(startedActivities);

    const dismissed = new Set(
      [...this.suggestions.values()]
        .filter(
          (item) =>
            item.user === user &&
            item.status === "dismissed",
        )
        .map((item) => item.activity),
    );

    const userPreferences = preferences.filter(
      (item) => item.user === user,
    );

    const notInterested = new Set(
      userPreferences
        .filter((item) => item.status === "notInterested")
        .map((item) => item.subject),
    );

    const positivePreferences = userPreferences.filter(
      (item) =>
        item.status === "interested" ||
        item.status === "curious",
    );

    const related = new Map<string, Set<string>>();

    for (const connection of connections) {
      if (!related.has(connection.first)) {
        related.set(connection.first, new Set());
      }

      if (!related.has(connection.second)) {
        related.set(connection.second, new Set());
      }

      related.get(connection.first)!.add(connection.second);
      related.get(connection.second)!.add(connection.first);
    }

    const candidates: InterestCandidate[] = activities
      .filter(
        (activity) =>
          !started.has(activity.activity) &&
          !dismissed.has(activity.activity) &&
          !notInterested.has(activity.activity),
      )
      .map((activity) => {
        let relevanceScore = 0;

        for (const preference of positivePreferences) {
          const weight =
            preference.status === "interested" ? 3 : 1;

          if (preference.subject === activity.activity) {
            relevanceScore += weight * 2;
          } else if (
            related
              .get(preference.subject)
              ?.has(activity.activity)
          ) {
            relevanceScore += weight;
          }
        }

        return {
          activity: activity.activity,
          name: activity.name,
          description: activity.description,
          relevanceScore,
        };
      })
      .sort(
        (a, b) =>
          b.relevanceScore - a.relevanceScore ||
          a.name.localeCompare(b.name) ||
          a.activity.localeCompare(b.activity),
      );

    const limit = Math.min(3, candidates.length);

    const input: InterestGenerationInput = {
      preferences: userPreferences.map((item) => ({
        subject: item.subject,
        status: item.status,
      })),
      candidates,
      connections: connections.map((item) => ({
        first: item.first,
        second: item.second,
      })),
      limit,
    };

    let selectedIds: string[];

    if (limit === 0) {
      selectedIds = [];
    } else {
      try {
        selectedIds =
          await this.generator.recommendActivities(input);

        const allowed = new Set(
          candidates.map((item) => item.activity),
        );

        if (
          selectedIds.length !== limit ||
          new Set(selectedIds).size !== selectedIds.length ||
          !selectedIds.every((id) => allowed.has(id))
        ) {
          throw new Error("Invalid AI recommendations.");
        }
      } catch {
        // Deterministic ranking when OpenAI is unavailable.
        selectedIds = candidates
          .slice(0, limit)
          .map((item) => item.activity);
      }
    }

    // Prevent an older generation request from overwriting
    // a newer request for the same user.
    if (this.revisions.get(user) !== revision) {
      return { suggestions: [] };
    }

    // A dismissal may have occurred while the API was running.
    const currentlyDismissed = new Set(
      [...this.suggestions.values()]
        .filter(
          (item) =>
            item.user === user &&
            item.status === "dismissed",
        )
        .map((item) => item.activity),
    );

    const finalIds = selectedIds.filter(
      (id) =>
        !currentlyDismissed.has(id) &&
        !started.has(id),
    );

    // Replace the user's pending suggestions.
    // Keep dismissed records so they stay excluded.
    for (const [id, item] of this.suggestions) {
      if (
        item.user === user &&
        item.status === "pending"
      ) {
        this.suggestions.delete(id);
      }
    }

    const suggestionIds: string[] = [];

    for (const activity of finalIds) {
      const suggestion = this.freshID();

      this.suggestions.set(suggestion, {
        suggestion,
        user,
        activity,
        status: "pending",
      });

      suggestionIds.push(suggestion);
    }

    return { suggestions: suggestionIds };
  }

  dismissSuggestion({
    user,
    suggestion,
  }: {
    user: string;
    suggestion: string;
  }): { suggestion: string } {
    const existing = this.suggestions.get(suggestion);

    if (
      !existing ||
      existing.user !== user ||
      existing.status !== "pending"
    ) {
      throw new SuggestionNotFound(
        "No pending suggestion exists for this user.",
      );
    }

    existing.status = "dismissed";

    return { suggestion };
  }

  _getSuggestions({
    user,
  }: {
    user: string;
  }): SuggestionRow[] {
    return [...this.suggestions.values()]
      .filter(
        (item) =>
          item.user === user &&
          item.status === "pending",
      )
      .sort(
        (a, b) =>
          a.activity.localeCompare(b.activity),
      )
      .map((item) => ({ ...item }));
  }
}
