
import { OpenAIStoryGenerator } from "../ai/OpenAIStoryGenerator.ts";

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

export type ChapterRow = {
  chapter: string;
  story: string;
  position: number;
  text: string;
  question?: string;
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

export class StoryGenerationConcept {
  private readonly stories = new Map<string, StoryRow>();
  private readonly chapters = new Map<string, ChapterRow>();

  constructor(
    private readonly freshID: () => string = () => crypto.randomUUID(),
    private readonly generator: StoryGenerator =
      new OpenAIStoryGenerator(),
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

    const generated = await this.#generateChapter({
      position: 1,
      activity,
      context,
      previousChapters: [],
    });

    // Recheck after awaiting the external generator.
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
  }: {
    user: string;
    story: string;
    answer: string;
  }): Promise<{ chapter: string }> {
    const existing = this.stories.get(story);

    if (!existing || existing.user !== user) {
      throw new StoryNotFound(
        "This story does not belong to the user.",
      );
    }

    const cleanedAnswer = answer.trim();

    if (!cleanedAnswer) {
      throw new InvalidStoryAnswer(
        "An answer cannot be blank.",
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
          throw new Error("A story chapter is missing.");
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

    const generated = await this.#generateChapter({
      position,
      activity: existing.activity,
      context: existing.context,
      previousChapters,
    });

    // Prevent concurrent requests from creating extra chapters.
    if (
      existing.chapters.length !== position - 1 ||
      latestChapter.answer !== undefined
    ) {
      throw new StoryCannotContinue(
        "The story changed while generating its next chapter.",
      );
    }

    latestChapter.answer = cleanedAnswer;

    const chapter = this.freshID();

    const nextChapter: ChapterRow = {
      chapter,
      story,
      position,
      text: generated.text,
      question: generated.question,
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
      throw new StoryNotFound(
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

        return { ...chapter };
      }),
    };
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

  async #generateChapter(
    input: StoryChapterContext,
  ): Promise<GeneratedStoryChapter> {
    try {
      const chapter = await this.generator.generateChapter(input);

      if (
        !chapter.text?.trim() ||
        chapter.text.length > 5000
      ) {
        throw new Error("Invalid AI chapter text.");
      }

      if (
        input.position < 3 &&
        !chapter.question?.trim()
      ) {
        throw new Error("Missing AI chapter question.");
      }

      if (
        input.position === 3 &&
        !chapter.suggestedActivity?.trim()
      ) {
        throw new Error("Missing AI suggested activity.");
      }

      return {
        text: chapter.text.trim(),
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
      // Keep the user flow working if the API is unavailable.
      return this.#fallbackChapter(input);
    }
  }

  #fallbackChapter(
    input: StoryChapterContext,
  ): GeneratedStoryChapter {
    const { position, activity, context, previousChapters } =
      input;

    if (position === 1) {
      return {
        text:
          `You are about to explore a new activity: ${activity}. ` +
          `Imagine meeting someone who enjoys this activity. ` +
          `They invite you to discover what makes it interesting.` +
          (context.trim()
            ? ` You bring your own perspective: ${context.trim()}.`
            : ""),
        question:
          "What would you like to discover about this activity?",
      };
    }

    const previousAnswer =
      previousChapters.at(-1)?.answer ?? "";

    if (position === 2) {
      return {
        text:
          `Your answer was: "${previousAnswer}". ` +
          `As you explore ${activity}, ` +
          `you meet someone who shows you another side ` +
          `of the activity. You get to make a choice ` +
          `about what to explore next.`,
        question:
          "Which part of this experience would you like to try?",
      };
    }

    return {
      text:
        `Your choice was: "${previousAnswer}". ` +
        `Your exploration of ${activity} ` +
        `has reached its conclusion. ` +
        `You can decide whether you want to ` +
        `explore this activity further.`,
      suggestedActivity:
        `Try a small ${activity} activity ` +
        `for ten minutes using materials you already have.`,
    };
  }
}
