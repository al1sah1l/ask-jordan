
import type {
  assembleApplication,
} from "../assembly.ts";

type Application = ReturnType<typeof assembleApplication>;

function requireRecord(
  value: unknown,
): Record<string, unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new Error(
      `Invalid result: ${JSON.stringify(value)}`,
    );
  }

  const result = value as Record<string, unknown>;

  if (typeof result.error === "string") {
    throw new Error(
      `${result.error}: ${String(result.detail ?? "")}`,
    );
  }

  return result;
}

function requireString(
  value: unknown,
  field: string,
): string {
  const result = requireRecord(value);

  if (typeof result[field] !== "string") {
    throw new Error(
      `Expected string field "${field}".`,
    );
  }

  return result[field];
}

export async function startStoryExploration(
  app: Application,
  input: {
    user: string;
    activity: string;
    context: string;
  },
): Promise<{
  story: string;
  chapter: string;
  exploration: string;
}> {
  // The reaction starts the exploration automatically.
  const generated =
    await app.concepts.StoryGeneration.generateStory(input);

  const story = requireString(generated, "story");
  const chapter = requireString(generated, "chapter");

  const explorations =
    await app.concepts.ExplorationTracking._get({
      user: input.user,
      story,
    });

  if (explorations.length !== 1) {
    throw new Error(
      "The story was created, but its exploration was not initialized.",
    );
  }

  const exploration = explorations[0];

  if (exploration.status !== "started") {
    throw new Error(
      "A newly created exploration must have status started.",
    );
  }

  return {
    story,
    chapter,
    exploration: exploration.exploration,
  };
}

export async function completeStoryExploration(
  app: Application,
  input: {
    user: string;
    story: string;
  },
): Promise<{ exploration: string }> {
  const result =
    await app.concepts.StoryGeneration.getStory(input);

  const record = requireRecord(result);

  if (!Array.isArray(record.chapters)) {
    throw new Error("Story chapters are missing.");
  }

  const chapters = record.chapters as Array<{
    position: number;
  }>;

  const positions = chapters
    .map((chapter) => chapter.position)
    .sort((a, b) => a - b);

  if (
    positions.length !== 3 ||
    positions[0] !== 1 ||
    positions[1] !== 2 ||
    positions[2] !== 3
  ) {
    throw new Error(
      "The user must finish all three chapters before completing the exploration.",
    );
  }

  const completion =
    await app.concepts.ExplorationTracking.completeExploration(
      input,
    );

  return {
    exploration: requireString(
      completion,
      "exploration",
    ),
  };
}
