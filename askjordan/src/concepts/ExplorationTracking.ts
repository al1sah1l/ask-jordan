
export class ExplorationAlreadyStarted extends Error {}
export class ExplorationNotStarted extends Error {}

export type ExplorationRow = {
  exploration: string;
  user: string;
  story: string;
  status: "started" | "completed";
};

export class ExplorationTrackingConcept {
  private readonly explorations = new Map<string, ExplorationRow>();

  constructor(
    private readonly freshID: () => string = () => crypto.randomUUID(),
  ) {}

  startExploration({
    user,
    story,
  }: {
    user: string;
    story: string;
  }): { exploration: string } {
    const existing = this.#find(user, story);

    if (existing) {
      throw new ExplorationAlreadyStarted(
        "This story already has an exploration.",
      );
    }

    const exploration = this.freshID();

    this.explorations.set(exploration, {
      exploration,
      user,
      story,
      status: "started",
    });

    return { exploration };
  }

  completeExploration({
    user,
    story,
  }: {
    user: string;
    story: string;
  }): { exploration: string } {
    const existing = this.#find(user, story);

    if (!existing || existing.status !== "started") {
      throw new ExplorationNotStarted(
        "This user has no started exploration for this story.",
      );
    }

    existing.status = "completed";

    return { exploration: existing.exploration };
  }

  _get({
    user,
    story,
  }: {
    user: string;
    story: string;
  }): ExplorationRow[] {
    const exploration = this.#find(user, story);

    return exploration ? [{ ...exploration }] : [];
  }

  _history({
    user,
  }: {
    user: string;
  }): ExplorationRow[] {
    return [...this.explorations.values()]
      .filter((exploration) => exploration.user === user)
      .sort((a, b) =>
        a.exploration.localeCompare(b.exploration),
      )
      .map((exploration) => ({ ...exploration }));
  }

  _completed({
    user,
  }: {
    user: string;
  }): ExplorationRow[] {
    return [...this.explorations.values()]
      .filter(
        (exploration) =>
          exploration.user === user &&
          exploration.status === "completed",
      )
      .sort((a, b) =>
        a.exploration.localeCompare(b.exploration),
      )
      .map((exploration) => ({ ...exploration }));
  }

  #find(
    user: string,
    story: string,
  ): ExplorationRow | undefined {
    return [...this.explorations.values()].find(
      (exploration) =>
        exploration.user === user &&
        exploration.story === story,
    );
  }
}
