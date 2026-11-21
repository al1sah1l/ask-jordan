
import { OpenAIStoryGenerator } from "../src/ai/OpenAIStoryGenerator.ts";

import type {
  StoryChapterContext,
  GeneratedStoryChapter,
} from "../src/ai/StoryGenerator.ts";

async function main(): Promise<void> {
  const apiKey = Bun.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to your .env file.",
    );
  }

  const model = Bun.env.OPENAI_STORY_MODEL ?? "gpt-4.1-mini";

  const generator = new OpenAIStoryGenerator({
    apiKey,
    model,
    timeoutMs: 30000,
  });

  const activity = "Photography";

  const context =
    "A middle school student enjoys soccer and wants " +
    "to explore photography. They have a smartphone " +
    "camera and prefer activities they can try at home " +
    "or in familiar public places with family.";

  const answers = [
    "I want to photograph soccer players in motion.",
    "I want to experiment with capturing the exact moment someone kicks the ball.",
  ];

  const previousChapters: StoryChapterContext["previousChapters"] = [];

  console.log("ASK JORDAN: THREE-CHAPTER AI STORY");
  console.log("Model:", model);
  console.log("Activity:", activity);
  console.log("Context:", context);
  console.log("=".repeat(60));

  for (const position of [1, 2, 3] as const) {
    console.log(`\nGenerating chapter ${position}...\n`);

    const chapter: GeneratedStoryChapter =
      await generator.generateChapter({
        position,
        activity,
        context,
        previousChapters: previousChapters.map(
          (previous) => ({ ...previous }),
        ),
      });

    console.log("-".repeat(60));
    console.log(`CHAPTER ${position}`);
    console.log("-".repeat(60));
    console.log("\n" + chapter.text);

    if (chapter.question) {
      console.log("\nQUESTION:");
      console.log(chapter.question);
    }

    if (chapter.suggestedActivity) {
      console.log("\nREAL-WORLD ACTIVITY:");
      console.log(chapter.suggestedActivity);
    }

    const answer =
      position < 3 ? answers[position - 1] : undefined;

    if (answer) {
      console.log("\nGEORGE'S ANSWER:");
      console.log(answer);
    }

    previousChapters.push({
      position,
      text: chapter.text,
      question: chapter.question,
      answer,
    });

    console.log("\n" + "=".repeat(60));
  }

  if (previousChapters.length !== 3) {
    throw new Error("Expected exactly three chapters.");
  }

  if (
    previousChapters[0].question === undefined ||
    previousChapters[1].question === undefined
  ) {
    throw new Error(
      "Chapters 1 and 2 must contain questions.",
    );
  }

  if (previousChapters[2].question !== undefined) {
    throw new Error(
      "Chapter 3 must not have a question.",
    );
  }

  console.log("\nSUCCESS: All three AI chapters were generated.");
  console.log("The previous chapters and answers were passed to OpenAI.");
  console.log(
    "Review the story manually to verify continuity and personalization.",
  );
}

await main();
