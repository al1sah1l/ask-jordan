
import { createStoryGenerator } from "../ai/createStoryGenerator.ts";
import { legacyPreparedQuestions, PreparedStoryGenerator } from "../ai/PreparedStoryGenerator.ts";

import {
  EXPORT_STATE,
  RESTORE_STATE,
} from "../persistence-symbols.ts";

import type {
  GeneratedStoryChapter,
  StoryChapterContext,
  StoryChapterPosition,
  StoryGenerator,
} from "../ai/StoryGenerator.ts";

export class StoryAlreadyExists extends Error {}
export class StoryNotFound extends Error {}
export class InvalidStoryAnswer extends Error {}
export class StoryCannotContinue extends Error {}
export class StaleStoryChapter extends Error {}
export class GetStoryNotFound extends StoryNotFound {}
export class ActivityStoryNotFound extends StoryNotFound {}
export class ActivityNotReached extends Error {}

export type ChapterRow = {
  chapter: string;
  story: string;
  position: number;
  text: string;
  question?: string;
  choices?: string[];
  answer?: string;
  suggestedActivity?: string;
};

export type StoryRow = {
  story: string;
  user: string;
  activity: string;
  context: string;
  chapters: string[];
};

export type StorySummary = {
  story: string;
  user: string;
  activity: string;
};

export type StoryGenerationState = {
  stories: StoryRow[];
  chapters: ChapterRow[];
};

export class StoryGenerationConcept {
  private readonly stories = new Map<string, StoryRow>();
  private readonly chapters = new Map<string, ChapterRow>();

  constructor(
    private readonly freshID: () => string =
      () => crypto.randomUUID(),

    private readonly generator: StoryGenerator =
      createStoryGenerator(),

    private readonly resolveActivity: (
      activity: string,
    ) => string = (activity) => activity,
  ) {}

  async generateStory({
    user,
    activity,
    context,
  }: {
    user: string;
    activity: string;
    context: string;
  }): Promise<{ story: string; chapter: string }> {
    const existing = [...this.stories.values()].find(
      (item) =>
        item.user === user &&
        item.activity === activity,
    );

    if (existing) {
      throw new StoryAlreadyExists(
        "This user already has a story for this activity.",
      );
    }

    const activityDescription =
      this.resolveActivity(activity);

    const generated = await this.#generateChapter({
      position: 1,
      activity: activityDescription,
      context,
      previousChapters: [],
    });

    const duplicate = [...this.stories.values()].find(
      (item) =>
        item.user === user &&
        item.activity === activity,
    );

    if (duplicate) {
      throw new StoryAlreadyExists(
        "This user already has a story for this activity.",
      );
    }

    const story = this.freshID();
    const chapter = this.freshID();

    const firstChapter: ChapterRow = {
      chapter,
      story,
      position: 1,
      text: generated.text,
      question: generated.question,
      choices: generated.choices ? [...generated.choices] : undefined,
    };

    this.stories.set(story, {
      story,
      user,
      activity,
      context,
      chapters: [chapter],
    });

    this.chapters.set(chapter, firstChapter);

    return { story, chapter };
  }

  async continueStory({
    user,
    story,
    answer,
    expectedChapter,
  }: {
    user: string;
    story: string;
    answer: string;
    expectedChapter?: string | null;
  }): Promise<{ chapter: string }> {
    const existing = this.stories.get(story);

    if (!existing || existing.user !== user) {
      throw new StoryNotFound(
        "This story does not belong to the user.",
      );
    }

    const currentChapterId = existing.chapters.at(-1);
    const currentChapter = currentChapterId ? this.chapters.get(currentChapterId) : undefined;
    if (expectedChapter != null && (expectedChapter !== currentChapterId || !currentChapter?.question || currentChapter.answer !== undefined)) {
      throw new StaleStoryChapter("This chapter has already changed; reopen the story.");
    }
    const cleanedAnswer = typeof answer === "string" ? answer.trim() : "";

    if (!cleanedAnswer || (currentChapter?.choices && !currentChapter.choices.includes(cleanedAnswer))) {
      throw new InvalidStoryAnswer(
        "Choose an offered answer or enter a nonblank answer for an open question.",
      );
    }

    if (existing.chapters.length >= 3) {
      throw new StoryCannotContinue(
        "The story has already reached its final chapter.",
      );
    }

    const latestChapterId =
      existing.chapters[existing.chapters.length - 1];

    const latestChapter = this.chapters.get(latestChapterId);

    if (
      !latestChapter ||
      !latestChapter.question ||
      latestChapter.answer !== undefined
    ) {
      throw new StoryCannotContinue(
        "The latest chapter cannot be continued.",
      );
    }

    const position = (
      existing.chapters.length + 1
    ) as StoryChapterPosition;

    const previousChapters = existing.chapters.map(
      (chapterId) => {
        const previous = this.chapters.get(chapterId);

        if (!previous) {
          throw new Error(
            "A story chapter is missing.",
          );
        }

        return {
          position: previous.position,
          text: previous.text,
          question: previous.question,
          answer:
            previous.chapter === latestChapterId
              ? cleanedAnswer
              : previous.answer,
        };
      },
    );

    const activityDescription =
      this.resolveActivity(existing.activity);

    const generated = await this.#generateChapter({
      position,
      activity: activityDescription,
      context: existing.context,
      previousChapters,
    });

    if (
      existing.chapters.length !== position - 1 ||
      latestChapter.answer !== undefined
    ) {
      if (expectedChapter != null) throw new StaleStoryChapter("This chapter has already changed; reopen the story.");
      throw new StoryCannotContinue("The story changed while generating its next chapter.");
    }

    latestChapter.answer = cleanedAnswer;

    const chapter = this.freshID();

    const nextChapter: ChapterRow = {
      chapter,
      story,
      position,
      text: generated.text,
      question: generated.question,
      choices: generated.choices ? [...generated.choices] : undefined,
      suggestedActivity: generated.suggestedActivity,
    };

    existing.chapters.push(chapter);
    this.chapters.set(chapter, nextChapter);

    return { chapter };
  }

  getStory({
    user,
    story,
  }: {
    user: string;
    story: string;
  }): { chapters: ChapterRow[] } {
    const existing = this.stories.get(story);

    if (!existing || existing.user !== user) {
      throw new GetStoryNotFound(
        "This story does not belong to the user.",
      );
    }

    return {
      chapters: existing.chapters.map((chapterId) => {
        const chapter = this.chapters.get(chapterId);

        if (!chapter) {
          throw new Error(
            "A chapter referenced by this story is missing.",
          );
        }

        return { ...chapter, choices: chapter.choices ? [...chapter.choices] : undefined };
      }),
    };
  }

  getActivityChapter({ user, story }: { user: string; story: string }): { chapter: string } {
    const existing = this.stories.get(story);
    if (!existing || existing.user !== user) throw new ActivityStoryNotFound("This story does not belong to the user.");
    const final = existing.chapters.map((id) => this.chapters.get(id)).find((row) => row?.position === 3 && row.suggestedActivity?.trim());
    if (!final) throw new ActivityNotReached("Reach the final activity before saving your work.");
    return { chapter: final.chapter };
  }

  getStories({
    user,
  }: {
    user: string;
  }): { stories: StorySummary[] } {
    const stories = [...this.stories.values()]
      .filter((story) => story.user === user)
      .map((story) => ({
        story: story.story,
        user: story.user,
        activity: story.activity,
      }))
      .sort((a, b) =>
        a.activity.localeCompare(b.activity),
      );

    return { stories };
  }

  [EXPORT_STATE](): StoryGenerationState {
    return {
      stories: [...this.stories.values()].map(
        (row) => ({
          ...row,
          chapters: [...row.chapters],
        }),
      ),
      chapters: [...this.chapters.values()].map(
        (row) => ({ ...row, choices: row.choices ? [...row.choices] : undefined }),
      ),
    };
  }

  [RESTORE_STATE](state: StoryGenerationState): void {
    this.stories.clear();
    this.chapters.clear();

    for (const row of state.stories) {
      this.stories.set(row.story, {
        ...row,
        chapters: [...row.chapters],
      });
    }

    for (const row of state.chapters) {
      // BSON stores explicit undefined values as null; restore optional leaves.
      const upgradedQuestion = row.answer == null && typeof row.question === "string" ? legacyPreparedQuestions[row.question] : undefined;
      this.chapters.set(row.chapter, {
        ...row,
        question: upgradedQuestion ?? row.question ?? undefined,
        choices: upgradedQuestion ? undefined : validChoices(row.choices) ? [...row.choices] : undefined,
        answer: row.answer ?? undefined,
        suggestedActivity: row.suggestedActivity ?? undefined,
      });
    }
  }

  async #generateChapter(
    input: StoryChapterContext,
  ): Promise<GeneratedStoryChapter> {
    try {
      const chapter =
        await this.generator.generateChapter(input);

      if (
        typeof chapter?.text !== "string" || !chapter.text.trim() ||
        chapter.text.length > 5000
      ) {
        throw new Error("Invalid AI chapter text.");
      }

      if (
        input.position < 3 &&
        (typeof chapter.question !== "string" || !chapter.question.trim() || chapter.question.length > 500)
      ) {
        throw new Error(
          "Missing AI chapter question.",
        );
      }

      if (
        input.position === 3 &&
        (typeof chapter.suggestedActivity !== "string" || !chapter.suggestedActivity.trim() || chapter.suggestedActivity.length > 1000)
      ) {
        throw new Error(
          "Missing AI suggested activity.",
        );
      }

      if (input.position < 3 && chapter.choices != null && (!validChoices(chapter.choices) || /\bwhy\b/i.test(chapter.question!))) {
        return this.#fallbackChapter(input);
      }
      return {
        text: chapter.text.trim(),
        choices: input.position < 3 && validChoices(chapter.choices) ? [...chapter.choices] : undefined,
        question:
          input.position < 3
            ? chapter.question!.trim()
            : undefined,
        suggestedActivity:
          input.position === 3
            ? chapter.suggestedActivity!.trim()
            : undefined,
      };
    } catch {
      return this.#fallbackChapter(input);
    }
  }

  #fallbackChapter(input: StoryChapterContext): Promise<GeneratedStoryChapter> {
    return new PreparedStoryGenerator().generateChapter(input);
  }
}

/** Validate choices together with their question; never manufacture alternatives. */
export function validChoices(value: unknown): value is string[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= 4 && value.every((item) => typeof item === "string" && !!item.trim() && item === item.trim() && item.length <= 200) && new Set(value).size === value.length;
}
