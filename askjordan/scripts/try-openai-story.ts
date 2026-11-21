
import { OpenAIStoryGenerator } from "../src/ai/OpenAIStoryGenerator.ts";

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
  });

  console.log("Testing real OpenAI story generation...");
  console.log("Model:", model);
  console.log("Activity: Photography\n");

  const chapter = await generator.generateChapter({
    position: 1,
    activity: "Photography",
    context:
      "A middle school student enjoys soccer and wants to explore creative hobbies.",
    previousChapters: [],
  });

  console.log("=".repeat(50));
  console.log("CHAPTER 1");
  console.log("=".repeat(50));

  console.log("\n" + chapter.text);

  console.log("\n" + "=".repeat(50));
  console.log("QUESTION");
  console.log("=".repeat(50));

  console.log("\n" + chapter.question);

  console.log("\n" + "=".repeat(50));
  console.log("SUCCESS: OpenAI generated a story chapter.");
}

await main();
