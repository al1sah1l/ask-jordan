
import {
  ChapterNotReady,
  confirmChapterReflection,
  createProgressiveChapter,
  InvalidChapterTransition,
  submitFirstChoice,
  submitSecondChoice,
  type LearningQuestion,
  type LearningTheory,
  type ProgressiveChapter,
} from "./ProgressiveChapter.ts";

export type ProgressiveStory = {
  story: string;
  user: string;
  activity: string;
  context: string;
  chapters: ProgressiveChapter[];
};

export type ProgressiveStorySnapshot = {
  stories: ProgressiveStory[];
};

export type ChapterGenerationInput = {
  activity: string;
  context: string;
  position: number;
  previousChapters: ProgressiveChapter[];
};

export interface ProgressiveContentGenerator {
  beginChapter(input: ChapterGenerationInput): Promise<{
    theory: LearningTheory;
    introduction: string;
    firstQuestion: LearningQuestion;
  }>;

  afterFirstChoice(input: {
    activity: string;
    chapter: ProgressiveChapter;
    answer: string;
  }): Promise<{
    scene: string;
    question: LearningQuestion;
  }>;

  afterSecondChoice(input: {
    activity: string;
    chapter: ProgressiveChapter;
    answer: string;
  }): Promise<{
    conclusion: string;
    practicalChallenge: string;
  }>;
}

export type ReflectionVerifier = (input: {
  user: string;
  story: string;
  chapter: string;
}) => Promise<string | null>;

export class ProgressiveStoryNotFound extends Error {}
export class ProgressiveStoryAlreadyExists extends Error {}
export class StaleProgressiveChapter extends Error {}

function copy<T>(value: T): T {
  return structuredClone(value);
}

export class ProgressiveStoryEngine {
  private readonly stories =
    new Map<string, ProgressiveStory>();

  constructor(
    private readonly generator: ProgressiveContentGenerator,
    private readonly verifyReflection: ReflectionVerifier,
    private readonly freshID: () => string =
      () => crypto.randomUUID(),
  ) {}

  async startStory({
    user,
    activity,
    context,
  }: {
    user: string;
    activity: string;
    context: string;
  }): Promise<{ story: string; chapter: string }> {
    if (this.findUserActivity(user, activity)) {
      throw new ProgressiveStoryAlreadyExists(
        "This activity already has a progressive story.",
      );
    }

    const generated = await this.generator.beginChapter({
      activity,
      context,
      position: 1,
      previousChapters: [],
    });

    // Check again after asynchronous generation.
    if (this.findUserActivity(user, activity)) {
      throw new ProgressiveStoryAlreadyExists(
        "This activity already has a progressive story.",
      );
    }

    const story = this.freshID();
    const chapter = this.freshID();

    const first = createProgressiveChapter({
      story,
      chapter,
      position: 1,
      theory: generated.theory,
      introduction: generated.introduction,
      firstQuestion: generated.firstQuestion,
    });

    this.stories.set(story, {
      story,
      user,
      activity,
      context,
      chapters: [first],
    });

    return { story, chapter };
  }

  getStory({
    user,
    story,
  }: {
    user: string;
    story: string;
  }): ProgressiveStory {
    return copy(this.requireStory(user, story));
  }

  async submitChoice({
    user,
    story,
    chapter,
    answer,
    expectedStage,
  }: {
    user: string;
    story: string;
    chapter: string;
    answer: string;
    expectedStage: "first-choice" | "second-choice";
  }): Promise<{ chapter: string; stage: string }> {
    const current = this.requireStory(user, story);
    const latest = this.latest(current);

    if (
      latest.chapter !== chapter ||
      latest.stage !== expectedStage
    ) {
      throw new StaleProgressiveChapter(
        "This chapter has changed. Reload it.",
      );
    }

    // Generate without mutating stored state.
    if (expectedStage === "first-choice") {
      const result =
        await this.generator.afterFirstChoice({
          activity: current.activity,
          chapter: copy(latest),
          answer,
        });

      this.checkCurrent(
        user,
        story,
        chapter,
        expectedStage,
        latest,
      );

      const updated = submitFirstChoice(
        latest,
        answer,
        result.scene,
        result.question,
      );

      current.chapters[current.chapters.length - 1] =
        updated;

      return {
        chapter,
        stage: updated.stage,
      };
    }

    const result =
      await this.generator.afterSecondChoice({
        activity: current.activity,
        chapter: copy(latest),
        answer,
      });

    this.checkCurrent(
      user,
      story,
      chapter,
      expectedStage,
      latest,
    );

    const updated = submitSecondChoice(
      latest,
      answer,
      result.conclusion,
      result.practicalChallenge,
    );

    current.chapters[current.chapters.length - 1] =
      updated;

    return {
      chapter,
      stage: updated.stage,
    };
  }

  /**
   * Called by a trusted backend composition.
   *
   * The verifier must read Reflecting's persisted
   * chapter-specific record. A client-supplied page ID
   * must never be treated as proof of reflection.
   */
  async confirmSavedReflection({
    user,
    story,
    chapter,
  }: {
    user: string;
    story: string;
    chapter: string;
  }): Promise<{ chapter: string }> {
    const current = this.requireStory(user, story);
    const latest = this.latest(current);

    if (
      latest.chapter !== chapter ||
      latest.stage !== "awaiting-reflection"
    ) {
      throw new ChapterNotReady(
        "This chapter is not ready for reflection.",
      );
    }

    const page = await this.verifyReflection({
      user,
      story,
      chapter,
    });

    if (!page) {
      throw new ChapterNotReady(
        "Save a reflection before continuing.",
      );
    }

    this.checkCurrent(
      user,
      story,
      chapter,
      "awaiting-reflection",
      latest,
    );

    current.chapters[current.chapters.length - 1] =
      confirmChapterReflection(latest, page);

    return { chapter };
  }

  async nextChapter({
    user,
    story,
  }: {
    user: string;
    story: string;
  }): Promise<{ chapter: string }> {
    const current = this.requireStory(user, story);
    const previous = this.latest(current);

    if (previous.stage !== "reflected") {
      throw new ChapterNotReady(
        "Complete your reflection first.",
      );
    }

    const position = previous.position + 1;

    const generated = await this.generator.beginChapter({
      activity: current.activity,
      context: current.context,
      position,
      previousChapters: copy(current.chapters),
    });

    this.checkCurrent(
      user,
      story,
      previous.chapter,
      "reflected",
      previous,
    );

    const chapter = this.freshID();

    const next = createProgressiveChapter(
      {
        story,
        chapter,
        position,
        theory: generated.theory,
        introduction: generated.introduction,
        firstQuestion: generated.firstQuestion,
      },
      previous,
    );

    current.chapters.push(next);

    return { chapter };
  }

  exportState(): ProgressiveStorySnapshot {
    return {
      stories: copy([...this.stories.values()]),
    };
  }

  restoreState(snapshot: ProgressiveStorySnapshot): void {
    const restored = new Map<string, ProgressiveStory>();
    const seenActivities = new Set<string>();

    for (const story of snapshot.stories) {
      if (
        !story.story ||
        !story.user ||
        !story.activity ||
        restored.has(story.story) ||
        story.chapters.length === 0
      ) {
        throw new InvalidChapterTransition(
          "Invalid progressive story snapshot.",
        );
      }

      const key = JSON.stringify([
        story.user,
        story.activity,
      ]);

      if (seenActivities.has(key)) {
        throw new InvalidChapterTransition(
          "Duplicate user/activity in snapshot.",
        );
      }

      for (let i = 0; i < story.chapters.length; i++) {
        const chapter = story.chapters[i]!;

        if (
          chapter.story !== story.story ||
          chapter.position !== i + 1
        ) {
          throw new InvalidChapterTransition(
            "Invalid chapter ordering.",
          );
        }

        if (
          i < story.chapters.length - 1 &&
          chapter.stage !== "reflected"
        ) {
          throw new InvalidChapterTransition(
            "An earlier chapter is incomplete.",
          );
        }
      }

      seenActivities.add(key);
      restored.set(story.story, copy(story));
    }

    this.stories.clear();

    for (const [id, story] of restored) {
      this.stories.set(id, story);
    }
  }

  private requireStory(
    user: string,
    story: string,
  ): ProgressiveStory {
    const found = this.stories.get(story);

    if (!found || found.user !== user) {
      throw new ProgressiveStoryNotFound(
        "This story does not belong to the user.",
      );
    }

    return found;
  }

  private latest(story: ProgressiveStory): ProgressiveChapter {
    const chapter = story.chapters.at(-1);

    if (!chapter) {
      throw new InvalidChapterTransition(
        "The story has no chapters.",
      );
    }

    return chapter;
  }

  private findUserActivity(
    user: string,
    activity: string,
  ): ProgressiveStory | undefined {
    return [...this.stories.values()].find(
      (item) =>
        item.user === user &&
        item.activity === activity,
    );
  }

  private checkCurrent(
    user: string,
    story: string,
    chapter: string,
    stage: ProgressiveChapter["stage"],
    previous: ProgressiveChapter,
  ): void {
    const current = this.requireStory(user, story);
    const latest = this.latest(current);

    if (
      latest.chapter !== chapter ||
      latest.stage !== stage ||
      latest !== previous
    ) {
      throw new StaleProgressiveChapter(
        "The story changed while processing the request.",
      );
    }
  }
}
