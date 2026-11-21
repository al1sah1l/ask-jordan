
export type InterestCandidate = {
  activity: string;
  name: string;
  description: string;
  relevanceScore: number;
};

export type InterestPreference = {
  subject: string;
  status: "interested" | "curious" | "notInterested";
};

export type InterestGenerationInput = {
  preferences: InterestPreference[];
  candidates: InterestCandidate[];
  connections: {
    first: string;
    second: string;
  }[];
  limit: number;
};

export interface InterestGenerator {
  recommendActivities(
    input: InterestGenerationInput,
  ): Promise<string[]>;
}
