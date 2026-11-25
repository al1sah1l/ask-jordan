import { PreparedStoryGenerator } from "./PreparedStoryGenerator.ts";
import type { ProgressiveContentGenerator } from "../learning/ProgressiveStoryEngine.ts";

/** Reuse the prepared adventure's two decisions and ending within a learning chapter. */
export class PreparedProgressiveGenerator implements ProgressiveContentGenerator {
  private readonly stories = new PreparedStoryGenerator();

  async beginChapter(input: Parameters<ProgressiveContentGenerator["beginChapter"]>[0]) {
    const opening = await this.stories.generateChapter({
      activity: input.activity,
      context: input.context,
      position: 1,
      previousChapters: [],
    });
    return {
      theory: {
        topic: "Plan, test, and improve",
        explanation: "Start with a small idea and explain your choice. Test one change at a time, compare what happens, and use what you notice to improve your next attempt.",
        keyTerms: ["planning", "testing", "reflection"],
      },
      introduction: opening.text,
      firstQuestion: { prompt: opening.question! },
    };
  }

  async afterFirstChoice(input: Parameters<ProgressiveContentGenerator["afterFirstChoice"]>[0]) {
    const next = await this.stories.generateChapter({
      activity: input.activity,
      context: "",
      position: 2,
      previousChapters: [{ position: 1, text: input.chapter.introduction, answer: input.answer }],
    });
    return { scene: next.text, question: { prompt: next.question! } };
  }

  async afterSecondChoice(input: Parameters<ProgressiveContentGenerator["afterSecondChoice"]>[0]) {
    const ending = await this.stories.generateChapter({
      activity: input.activity,
      context: "",
      position: 3,
      previousChapters: [
        { position: 1, text: input.chapter.introduction, answer: input.chapter.firstDecision?.answer },
        { position: 2, text: input.chapter.secondScene ?? "", answer: input.answer },
      ],
    });
    return { conclusion: ending.text, practicalChallenge: ending.suggestedActivity! };
  }
}
