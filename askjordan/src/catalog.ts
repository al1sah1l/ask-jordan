
import type { assembleApplication } from "./assembly.ts";

type Application = ReturnType<typeof assembleApplication>;

export const TOPICS = [
  {
    name: "Sports",
    description: "Explore activities connected to sports and movement.",
  },
  {
    name: "Arts & Media",
    description: "Explore photography, filmmaking, and creative expression.",
  },
  {
    name: "Technology",
    description: "Explore creative and practical uses of technology.",
  },
] as const;

export const ACTIVITIES = [
  {
    name: "Sports Photography",
    description: "Capture athletes, movement, and exciting sports moments.",
    topics: ["Sports", "Arts & Media"],
  },
  {
    name: "Sports Commentary",
    description: "Explain and narrate exciting moments during sports events.",
    topics: ["Sports", "Arts & Media"],
  },
  {
    name: "Filmmaking",
    description: "Tell stories through video, filming, and editing.",
    topics: ["Arts & Media", "Technology"],
  },
  {
    name: "Creative Writing",
    description: "Invent characters, stories, and imaginative worlds.",
    topics: ["Arts & Media"],
  },
  {
    name: "Game Design",
    description: "Create rules, challenges, and experiences for games.",
    topics: ["Technology", "Arts & Media"],
  },
  {
    name: "Robotics",
    description: "Explore building and programming moving machines.",
    topics: ["Technology"],
  },
  {
    name: "Music Production",
    description: "Experiment with sounds, rhythms, and digital music.",
    topics: ["Arts & Media", "Technology"],
  },
  {
    name: "Sports Analytics",
    description: "Use data to understand teams, athletes, and games.",
    topics: ["Sports", "Technology"],
  },
] as const;

export const ACTIVITY_LINKS = [
  ["Sports Photography", "Sports Commentary"],
  ["Sports Photography", "Filmmaking"],
  ["Sports Commentary", "Sports Analytics"],
  ["Filmmaking", "Creative Writing"],
  ["Filmmaking", "Music Production"],
  ["Game Design", "Robotics"],
] as const;


function getId(
  result: unknown,
  field: "topic" | "activity",
): string {
  if (
    typeof result !== "object" ||
    result === null ||
    Array.isArray(result)
  ) {
    throw new Error(
      `Catalog initialization failed: ${JSON.stringify(result)}`,
    );
  }

  const record = result as Record<string, unknown>;
  const value = record[field];

  if (typeof value !== "string") {
    throw new Error(
      `Catalog initialization failed: expected "${field}" in ${JSON.stringify(result)}`,
    );
  }

  return value;
}


export async function seedCatalog(app: Application) {
  const collection = app.concepts.InterestCollection;

  const topicIds = new Map<string, string>();
  const activityIds = new Map<string, string>();

  for (const topic of await collection._topics({})) {
    topicIds.set(topic.name, topic.topic);
  }

  for (const topic of TOPICS) {
    if (topicIds.has(topic.name)) continue;

    const result = await collection.registerTopic({
      name: topic.name,
      description: topic.description,
    });

    topicIds.set(topic.name, getId(result, "topic"));
  }

  for (const activity of await collection._activities({})) {
    activityIds.set(activity.name, activity.activity);
  }

  for (const activity of ACTIVITIES) {
    if (activityIds.has(activity.name)) continue;

    const topics = activity.topics.map((name) => {
      const id = topicIds.get(name);
      if (!id) throw new Error(`Unknown topic: ${name}`);
      return id;
    });

    const result = await collection.registerActivity({
      name: activity.name,
      description: activity.description,
      topics,
    });

    activityIds.set(
      activity.name,
      getId(result, "activity"),
    );
  }

  for (const [first, second] of ACTIVITY_LINKS) {
    const activity1 = activityIds.get(first);
    const activity2 = activityIds.get(second);

    if (!activity1 || !activity2) {
      throw new Error(`Unknown activity connection: ${first}, ${second}`);
    }

    const related = await collection._related({
      subject: activity1,
    });

    if (related.some((row) => row.subject === activity2)) {
      continue;
    }

    const result = await collection.connectActivities({
      activity1,
      activity2,
    });

    if ("error" in result) {
      throw new Error(
        `Could not connect ${first} and ${second}: ${result.error}`,
      );
    }
  }

  return {
    topics: await collection._topics({}),
    activities: await collection._activities({}),
    connections: await collection._connections({}),
  };
}
