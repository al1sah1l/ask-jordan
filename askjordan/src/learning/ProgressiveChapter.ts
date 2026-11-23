
/**
 * Ask Jordan — Progressive Chapter Model
 *
 * A Story is an ongoing exploration of an Activity.
 * Each Chapter is a complete educational experience.
 *
 * This module defines a pure state machine. It does not
 * generate AI content or save anything to a database.
 */

export type ChapterStage =
  | "first-choice"
  | "second-choice"
  | "awaiting-reflection"
  | "reflected";

export type LearningTheory = {
  topic: string;
  explanation: string;
  keyTerms: string[];
};

export type LearningQuestion = {
  prompt: string;
  options?: string[];
};

export type LearningDecision = {
  question: string;
  answer: string;
};

export type ProgressiveChapter = {
  chapter: string;
  story: string;
  position: number;

  // Educational content
  theory: LearningTheory;

  // Interactive narrative
  introduction: string;
  firstQuestion: LearningQuestion;
  firstDecision?: LearningDecision;

  secondScene?: string;
  secondQuestion?: LearningQuestion;
  secondDecision?: LearningDecision;

  conclusion?: string;
  practicalChallenge?: string;

  // Chapter lifecycle
  stage: ChapterStage;
  reflectionPage?: string;
};

export type NewChapterInput = {
  chapter: string;
  story: string;
  position: number;
  theory: LearningTheory;
  introduction: string;
  firstQuestion: LearningQuestion;
};

export class InvalidChapterTransition extends Error {}
export class InvalidChapterChoice extends Error {}
export class ChapterNotReady extends Error {}

function requireText(
  value: string,
  field: string,
): string {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    throw new Error(`${field} cannot be blank.`);
  }

  return value.trim();
}

function validateQuestion(
  question: LearningQuestion,
): LearningQuestion {
  const prompt = requireText(
    question.prompt,
    "Question",
  );

  if (question.options === undefined) {
    return { prompt };
  }

  const options = question.options.map(
    (option) => requireText(option, "Option"),
  );

  if (
    options.length < 2 ||
    options.length > 4 ||
    new Set(options).size !== options.length
  ) {
    throw new Error(
      "A multiple-choice question needs 2-4 distinct options.",
    );
  }

  return { prompt, options };
}

function validateAnswer(
  question: LearningQuestion,
  answer: string,
): string {
  const cleaned = answer.trim();

  if (!cleaned) {
    throw new InvalidChapterChoice(
      "Please provide an answer.",
    );
  }

  if (
    question.options &&
    !question.options.includes(cleaned)
  ) {
    throw new InvalidChapterChoice(
      "Choose one of the offered answers.",
    );
  }

  return cleaned;
}

/**
 * Create one new learning chapter.
 *
 * Progression between chapters is validated here,
 * but choosing the next educational topic belongs
 * to the future learning progression generator.
 */
export function createProgressiveChapter(
  input: NewChapterInput,
  previous?: ProgressiveChapter,
): ProgressiveChapter {
  if (
    !Number.isSafeInteger(input.position) ||
    input.position < 1
  ) {
    throw new Error(
      "Chapter position must be a positive integer.",
    );
  }

  if (previous) {
    if (previous.story !== input.story) {
      throw new InvalidChapterTransition(
        "Chapters must belong to the same story.",
      );
    }

    if (
      previous.position + 1 !== input.position
    ) {
      throw new InvalidChapterTransition(
        "Chapters must be consecutive.",
      );
    }

    if (previous.stage !== "reflected") {
      throw new ChapterNotReady(
        "Finish reflection before starting another chapter.",
      );
    }
  } else if (input.position !== 1) {
    throw new InvalidChapterTransition(
      "The first chapter must have position 1.",
    );
  }

  return {
    chapter: requireText(input.chapter, "Chapter ID"),
    story: requireText(input.story, "Story ID"),
    position: input.position,
    theory: {
      topic: requireText(
        input.theory.topic,
        "Theory topic",
      ),
      explanation: requireText(
        input.theory.explanation,
        "Theory explanation",
      ),
      keyTerms: [...input.theory.keyTerms],
    },
    introduction: requireText(
      input.introduction,
      "Story introduction",
    ),
    firstQuestion: validateQuestion(
      input.firstQuestion,
    ),
    stage: "first-choice",
  };
}

/**
 * Record the first decision and reveal its
 * consequence and the second question.
 */
export function submitFirstChoice(
  chapter: ProgressiveChapter,
  answer: string,
  secondScene: string,
  secondQuestion: LearningQuestion,
): ProgressiveChapter {
  if (chapter.stage !== "first-choice") {
    throw new InvalidChapterTransition(
      "The first choice has already been completed.",
    );
  }

  const cleaned = validateAnswer(
    chapter.firstQuestion,
    answer,
  );

  return {
    ...chapter,
    firstDecision: {
      question: chapter.firstQuestion.prompt,
      answer: cleaned,
    },
    secondScene: requireText(
      secondScene,
      "Second scene",
    ),
    secondQuestion: validateQuestion(
      secondQuestion,
    ),
    stage: "second-choice",
  };
}

/**
 * Record the second decision and finish this
 * chapter's story with a practical challenge.
 */
export function submitSecondChoice(
  chapter: ProgressiveChapter,
  answer: string,
  conclusion: string,
  practicalChallenge: string,
): ProgressiveChapter {
  if (
    chapter.stage !== "second-choice" ||
    !chapter.secondQuestion ||
    !chapter.firstDecision
  ) {
    throw new InvalidChapterTransition(
      "The second choice is not available.",
    );
  }

  const cleaned = validateAnswer(
    chapter.secondQuestion,
    answer,
  );

  return {
    ...chapter,
    secondDecision: {
      question: chapter.secondQuestion.prompt,
      answer: cleaned,
    },
    conclusion: requireText(
      conclusion,
      "Conclusion",
    ),
    practicalChallenge: requireText(
      practicalChallenge,
      "Practical challenge",
    ),
    stage: "awaiting-reflection",
  };
}

/**
 * Internal transition for the future composition.
 *
 * Must only be called AFTER Reflecting has
 * successfully saved this chapter's reflection.
 */
export function confirmChapterReflection(
  chapter: ProgressiveChapter,
  reflectionPage: string,
): ProgressiveChapter {
  if (chapter.stage !== "awaiting-reflection") {
    throw new InvalidChapterTransition(
      "This chapter is not ready for reflection.",
    );
  }

  return {
    ...chapter,
    reflectionPage: requireText(
      reflectionPage,
      "Reflection page",
    ),
    stage: "reflected",
  };
}

export function canStartNextChapter(
  chapter: ProgressiveChapter,
): boolean {
  return chapter.stage === "reflected";
}
