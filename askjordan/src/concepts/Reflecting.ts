export class JournalAlreadyExists extends Error {}
export class JournalCreated extends JournalAlreadyExists {}
export class NoJournalFound extends Error {}
export class NoJournal extends NoJournalFound {}
export class InvalidStoryOrChapter extends Error {}
export class NoEntry extends Error {}
export class NoPageFound extends Error {}
export class PageAlreadyExists extends Error {}
export class NoStoryFound extends Error {}

export type JournalRow = {
  journal: string;
  user: string;
};

export type PageRow = {
  page: string;
  story: string;
  chapter: string;
  text: string;
};

export class ReflectingConcept {
  private readonly journals = new Map<string, JournalRow>();
  private readonly journalPages = new Map<string, Set<string>>();
  private readonly pages = new Map<string, PageRow>();

  constructor(
    private readonly freshID: () => string = () => crypto.randomUUID(),
  ) {}

  createJournal({ user }: { user: string }): { journal: string } {
    const existing = this.#findJournal(user);

    if (existing) {
      throw new JournalAlreadyExists("This user already has a journal.");
    }

    const journal = this.freshID();
    this.journals.set(journal, { journal, user });
    this.journalPages.set(journal, new Set<string>());

    return { journal };
  }

  write({
    user,
    story,
    chapter,
    text,
  }: {
    user: string;
    story: string;
    chapter: string | number;
    text: string;
  }): { page: string } {
    const journal = this.#requireJournal(user);

    if (!this.#validStory(story) || !this.#validChapter(chapter)) {
      throw new InvalidStoryOrChapter(
        "This story or chapter is invalid.",
      );
    }

    const cleanedText = text?.trim() ?? "";
    if (!cleanedText) {
      throw new NoEntry("You must write some reflection on your experience.");
    }

    const chapterKey = String(chapter);
    const existing = this.#findPage(
      journal.journal,
      chapterKey,
      story,
    );

    if (existing) {
      throw new PageAlreadyExists(
        "This journal already has a page for this chapter.",
      );
    }

    const page = this.freshID();
    this.pages.set(page, {
      page,
      story,
      chapter: chapterKey,
      text: cleanedText,
    });
    this.journalPages.get(journal.journal)?.add(page);

    return { page };
  }

  edit({
    user,
    story,
    chapter,
    text,
  }: {
    user: string;
    story: string;
    chapter: string | number;
    text: string;
  }): { page: string } {
    const journal = this.#requireJournal(user);

    if (!this.#validStory(story) || !this.#validChapter(chapter)) {
      throw new InvalidStoryOrChapter(
        "This story or chapter is invalid.",
      );
    }

    const cleanedText = text?.trim() ?? "";
    if (!cleanedText) {
      throw new NoEntry("You must write some reflection on your experience.");
    }

    const chapterKey = String(chapter);
    const existing = this.#findPage(
      journal.journal,
      chapterKey,
      story,
    );

    if (!existing) {
      throw new NoPageFound(
        "The page you want to edit could not be found.",
      );
    }

    existing.text = cleanedText;

    return { page: existing.page };
  }

  read({
    user,
    story,
  }: {
    user: string;
    story: string;
  }): { page: string } {
    const journal = this.#requireJournal(user);
    if (!this.#validStory(story)) {
      throw new InvalidStoryOrChapter(
        "This story or chapter is invalid.",
      );
    }

    const found = this.#findPageByStory(journal.journal, story);

    if (!found) {
      throw new NoStoryFound(
        "This user does not have an entry for this story.",
      );
    }

    return { page: found.page };
  }

  getJournal({ user }: { user: string }): { pages: PageRow[] } {
    const journal = this.#requireJournal(user);

    return {
      pages: [...this.pages.values()]
        .filter((page) => this.#ownsPage(journal.journal, page))
        .sort((a, b) =>
          Number(a.chapter) - Number(b.chapter) ||
          a.chapter.localeCompare(b.chapter)
        )
        .map((page) => ({ ...page })),
    };
  }

  _journal({ user }: { user: string }): JournalRow[] {
    const journal = this.#findJournal(user);
    return journal ? [{ ...journal }] : [];
  }

  _page({
    user,
    story,
    chapter,
  }: {
    user: string;
    story: string;
    chapter: string | number;
  }): PageRow[] {
    const journal = this.#findJournal(user);
    if (!journal) return [];

    return [...this.pages.values()]
      .filter((page) =>
        this.#ownsPage(journal.journal, page) &&
        page.story === story &&
        page.chapter === String(chapter)
      )
      .map((page) => ({ ...page }));
  }

  _pages({ user }: { user: string }): PageRow[] {
    const journal = this.#findJournal(user);
    if (!journal) return [];

    return [...this.pages.values()]
      .filter((page) => this.#ownsPage(journal.journal, page))
      .map((page) => ({ ...page }));
  }

  #findJournal(user: string): JournalRow | undefined {
    return [...this.journals.values()].find(
      (journal) => journal.user === user,
    );
  }

  #requireJournal(user: string): JournalRow {
    const journal = this.#findJournal(user);
    if (!journal) {
      throw new NoJournalFound("This user does not have a journal yet.");
    }
    return journal;
  }

  #findPage(
    journal: string,
    chapter: string,
    story?: string,
  ): PageRow | undefined {
    return [...this.pages.values()].find((page) => {
      if (!this.#ownsPage(journal, page)) return false;
      if (page.chapter !== chapter) return false;
      return story === undefined || page.story === story;
    });
  }

  #findPageByStory(
    journal: string,
    story: string,
  ): PageRow | undefined {
    return [...this.pages.values()].find((page) =>
      this.#ownsPage(journal, page) && page.story === story
    );
  }

  #ownsPage(journal: string, page: PageRow): boolean {
    return this.journalPages.get(journal)?.has(page.page) === true;
  }

  #validStory(story: string): boolean {
    return typeof story === "string" && story.trim() !== "";
  }

  #validChapter(chapter: string | number): boolean {
    if (typeof chapter === "number") {
      return Number.isFinite(chapter) && chapter >= 0;
    }
    return typeof chapter === "string" && chapter.trim() !== "";
  }
}
