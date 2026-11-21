
export type StoryChapterPosition = 1 | 2 | 3;

export type StoryChapterContext = {
  position: StoryChapterPosition;
  activity: string;
  context: string;
  previousChapters: {
    position: number;
    text: string;
    question?: string;
    answer?: string;
  }[];
};

export type GeneratedStoryChapter = {
  text: string;
  question?: string;
  suggestedActivity?: string;
};

export interface StoryGenerator {
  generateChapter(
    input: StoryChapterContext,
  ): Promise<GeneratedStoryChapter>;
}
