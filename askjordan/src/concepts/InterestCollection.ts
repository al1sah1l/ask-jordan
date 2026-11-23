
import {
  EXPORT_STATE,
  RESTORE_STATE,
} from "../persistence-symbols.ts";

export class InvalidCatalogEntry extends Error {}
export class CatalogEntryExists extends Error {}
export class CatalogEntryNotFound extends Error {}
export class ConnectionExists extends Error {}
export class InvalidPreference extends Error {}

export type InterestStatus =
  | "interested"
  | "curious"
  | "notInterested";

export type TopicRow = {
  topic: string;
  name: string;
  description: string;
};

export type ActivityRow = {
  activity: string;
  name: string;
  description: string;
};

export type ConnectionRow = {
  connection: string;
  first: string;
  second: string;
};

export type PreferenceRow = {
  preference: string;
  user: string;
  subject: string;
  status: InterestStatus;
};

export type InterestCollectionState = {
  topics: TopicRow[];
  activities: ActivityRow[];
  connections: ConnectionRow[];
  preferences: PreferenceRow[];
};

export class InterestCollectionConcept {
  private readonly topics = new Map<string, TopicRow>();
  private readonly activities =
    new Map<string, ActivityRow>();
  private readonly connections =
    new Map<string, ConnectionRow>();
  private readonly preferences =
    new Map<string, PreferenceRow>();

  constructor(
    private readonly freshID: () => string =
      () => crypto.randomUUID(),
  ) {}

  registerTopic({
    name,
    description,
  }: {
    name: string;
    description: string;
  }): { topic: string } {
    const normalizedName = name.trim();

    if (!normalizedName) {
      throw new InvalidCatalogEntry(
        "A topic name cannot be blank.",
      );
    }

    const exists = [...this.topics.values()].some(
      (topic) =>
        topic.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (exists) {
      throw new CatalogEntryExists(
        "This topic already exists.",
      );
    }

    const topic = this.freshID();

    this.topics.set(topic, {
      topic,
      name: normalizedName,
      description,
    });

    return { topic };
  }

  registerActivity({
    name,
    description,
    topics,
  }: {
    name: string;
    description: string;
    topics: string[];
  }): { activity: string } {
    const normalizedName = name.trim();
    const distinctTopics = [...new Set(topics)];

    if (!normalizedName || distinctTopics.length === 0) {
      throw new InvalidCatalogEntry(
        "An activity needs a name and at least one topic.",
      );
    }

    const exists = [...this.activities.values()].some(
      (activity) =>
        activity.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    if (exists) {
      throw new CatalogEntryExists(
        "This activity already exists.",
      );
    }

    for (const topic of distinctTopics) {
      if (!this.topics.has(topic)) {
        throw new CatalogEntryNotFound(
          "One of the topics does not exist.",
        );
      }
    }

    const activity = this.freshID();

    this.activities.set(activity, {
      activity,
      name: normalizedName,
      description,
    });

    for (const topic of distinctTopics) {
      this.#addConnection(topic, activity);
    }

    return { activity };
  }

  connectActivities({
    activity1,
    activity2,
  }: {
    activity1: string;
    activity2: string;
  }): { connection: string } {
    if (
      !this.activities.has(activity1) ||
      !this.activities.has(activity2)
    ) {
      throw new CatalogEntryNotFound(
        "Both activities must exist.",
      );
    }

    if (activity1 === activity2) {
      throw new InvalidCatalogEntry(
        "An activity cannot connect to itself.",
      );
    }

    if (this.#hasConnection(activity1, activity2)) {
      throw new ConnectionExists(
        "The connection already exists.",
      );
    }

    return {
      connection: this.#addConnection(
        activity1,
        activity2,
      ),
    };
  }

  setPreference({
    user,
    subject,
    status,
  }: {
    user: string;
    subject: string;
    status: InterestStatus;
  }): { preference: string } {
    if (
      !this.topics.has(subject) &&
      !this.activities.has(subject)
    ) {
      throw new CatalogEntryNotFound(
        "The topic or activity does not exist.",
      );
    }

    if (
      status !== "interested" &&
      status !== "curious" &&
      status !== "notInterested"
    ) {
      throw new InvalidPreference(
        "Invalid preference status.",
      );
    }

    const existing = [...this.preferences.values()].find(
      (item) =>
        item.user === user &&
        item.subject === subject,
    );

    if (existing) {
      existing.status = status;
      return { preference: existing.preference };
    }

    const preference = this.freshID();

    this.preferences.set(preference, {
      preference,
      user,
      subject,
      status,
    });

    return { preference };
  }

  _topics(
    {}: Record<string, never> = {},
  ): TopicRow[] {
    return [...this.topics.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  _activities(
    {}: Record<string, never> = {},
  ): ActivityRow[] {
    return [...this.activities.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  _connections(
    {}: Record<string, never> = {},
  ): ConnectionRow[] {
    return [...this.connections.values()].sort((a, b) =>
      a.connection.localeCompare(b.connection),
    );
  }

  _preferences({
    user,
  }: {
    user: string;
  }): PreferenceRow[] {
    return [...this.preferences.values()]
      .filter((item) => item.user === user)
      .sort((a, b) =>
        a.subject.localeCompare(b.subject),
      );
  }

  _related({
    subject,
  }: {
    subject: string;
  }): { subject: string }[] {
    if (
      !this.topics.has(subject) &&
      !this.activities.has(subject)
    ) {
      return [];
    }

    const related = new Set<string>();

    for (const connection of this.connections.values()) {
      if (connection.first === subject) {
        related.add(connection.second);
      }

      if (connection.second === subject) {
        related.add(connection.first);
      }
    }

    return [...related]
      .sort((a, b) => a.localeCompare(b))
      .map((subject) => ({ subject }));
  }

  [EXPORT_STATE](): InterestCollectionState {
    return {
      topics: [...this.topics.values()]
        .map((row) => ({ ...row })),
      activities: [...this.activities.values()]
        .map((row) => ({ ...row })),
      connections: [...this.connections.values()]
        .map((row) => ({ ...row })),
      preferences: [...this.preferences.values()]
        .map((row) => ({ ...row })),
    };
  }

  [RESTORE_STATE](state: InterestCollectionState): void {
    this.topics.clear();
    this.activities.clear();
    this.connections.clear();
    this.preferences.clear();

    for (const row of state.topics) {
      this.topics.set(row.topic, { ...row });
    }

    for (const row of state.activities) {
      this.activities.set(row.activity, { ...row });
    }

    for (const row of state.connections) {
      this.connections.set(row.connection, { ...row });
    }

    for (const row of state.preferences) {
      this.preferences.set(row.preference, { ...row });
    }
  }

  #hasConnection(first: string, second: string): boolean {
    return [...this.connections.values()].some(
      (connection) =>
        (connection.first === first &&
          connection.second === second) ||
        (connection.first === second &&
          connection.second === first),
    );
  }

  #addConnection(first: string, second: string): string {
    const connection = this.freshID();

    this.connections.set(connection, {
      connection,
      first,
      second,
    });

    return connection;
  }
}
