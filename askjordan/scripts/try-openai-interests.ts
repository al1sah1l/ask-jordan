
import { OpenAIInterestGenerator } from "../src/ai/OpenAIInterestGenerator.ts";

async function main(): Promise<void> {
  const apiKey = Bun.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to .env.",
    );
  }

  const generator = new OpenAIInterestGenerator({
    apiKey,
    model:
      Bun.env.OPENAI_INTEREST_MODEL ??
      "gpt-4.1-mini",
    timeoutMs: 30000,
  });

  const candidates = [
    {
      activity: "sports-photography",
      name: "Sports Photography",
      description:
        "Take creative action photos at sports games using a smartphone.",
      relevanceScore: 3,
    },
    {
      activity: "filmmaking",
      name: "Filmmaking",
      description:
        "Create short videos and learn about framing and storytelling.",
      relevanceScore: 0,
    },
    {
      activity: "sports-commentary",
      name: "Sports Commentary",
      description:
        "Practice narrating and analyzing exciting moments in a game.",
      relevanceScore: 3,
    },
    {
      activity: "songwriting",
      name: "Songwriting",
      description:
        "Write original lyrics and experiment with music.",
      relevanceScore: 0,
    },
    {
      activity: "graphic-design",
      name: "Graphic Design",
      description:
        "Make posters and visual designs with simple digital tools.",
      relevanceScore: 0,
    },
  ];

  console.log("ASK JORDAN - AI INTEREST GENERATION");
  console.log("Model:", Bun.env.OPENAI_INTEREST_MODEL ?? "gpt-4.1-mini");
  console.log("\nAvailable activities:");

  for (const candidate of candidates) {
    console.log(
      `- ${candidate.name} (${candidate.activity})`,
    );
  }

  console.log("\nGenerating recommendations...\n");

  const ids = await generator.recommendActivities({
    preferences: [
      {
        subject: "soccer",
        status: "interested",
      },
      {
        subject: "photography",
        status: "curious",
      },
    ],
    candidates,
    connections: [
      {
        first: "soccer",
        second: "sports-photography",
      },
      {
        first: "soccer",
        second: "sports-commentary",
      },
      {
        first: "photography",
        second: "sports-photography",
      },
    ],
    limit: 3,
  });

  console.log("AI RECOMMENDATIONS:");

  for (const [index, id] of ids.entries()) {
    const selected = candidates.find(
      (item) => item.activity === id,
    );

    if (!selected) {
      throw new Error(`Unknown recommended ID: ${id}`);
    }

    console.log(
      `${index + 1}. ${selected.name}`,
    );
    console.log(`   ${selected.description}`);
  }

  console.log("\nSUCCESS: OpenAI returned three valid catalog activities.");
}

await main();
