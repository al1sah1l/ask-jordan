import { MongoServerError, type Collection, type Db } from "mongodb";
import sharp from "sharp";
import { db } from "../db.ts";

export class JournalAlreadyExists extends Error {}
export class JournalCreated extends JournalAlreadyExists {}
export class NoJournalFound extends Error {}
export class NoJournal extends NoJournalFound {}
export class InvalidStoryOrChapter extends Error {}
export class NoEntry extends Error {}
export class NoPageFound extends Error {}
export class PageAlreadyExists extends Error {}
export class NoStoryFound extends Error {}
export class WriteNoJournal extends NoJournalFound {}
export class WriteInvalidEntry extends NoEntry {}
export class EditNoJournal extends NoJournalFound {}
export class EditInvalidReference extends InvalidStoryOrChapter {}
export class EditNoPage extends NoPageFound {}
export class EditAmbiguousPage extends Error {}
export class EditInvalidEntry extends NoEntry {}
export class ReadNoJournal extends NoJournalFound {}
export class ReadInvalidReference extends InvalidStoryOrChapter {}
export class ReadNoStory extends NoStoryFound {}
export class ReadNoPage extends NoPageFound {}
export class ReadAmbiguousPage extends Error {}
export class GetJournalNotFound extends NoJournalFound {}
export class SaveInvalidReference extends InvalidStoryOrChapter {}
export class SaveTextTooLong extends Error {}
export class SaveTooManyImages extends Error {}
export class SaveImageTooLarge extends Error {}
export class SaveInvalidImage extends Error {}
export class SaveNoEntry extends NoEntry {}
export class GetInvalidReference extends InvalidStoryOrChapter {}
export class ReflectionUnavailable extends Error {}

export const REFLECTION_LIMITS = {
  maxImages: 3,
  maxImageBytes: 1_048_576,
  maxTextCharacters: 5_000,
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  requestBodyBytes: 5_242_880,
};
export type JournalRow = { journal: string; user: string };
export type PageRow = { page: string; story: string; chapter: string; text: string; images: string[] };
type JournalDocument = JournalRow & { _id: string };
type PageDocument = PageRow & { _id: string; user: string; journal: string };
type Scope = { user: string; story: string; chapter: string | number };
type Filter = { user: string; story?: string; chapter?: string | number };
const validReference = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const validChapter = (value: unknown): value is string | number => validReference(value) || (typeof value === "number" && Number.isFinite(value) && value >= 0);
const pageRecord = (row: PageDocument): PageRow => ({ page: row.page, story: row.story, chapter: row.chapter, text: row.text, images: [...(row.images ?? [])] });

/** Each complete page has its own durable document; uploads never enter the application snapshot. */
export class ReflectingConcept {
  private readonly journals: Collection<JournalDocument>;
  private readonly pages: Collection<PageDocument>;
  private readonly freshID: () => string;

  constructor(database: Db = db, freshID: () => string = () => crypto.randomUUID()) {
    this.journals = database.collection<JournalDocument>("reflecting.journals");
    this.pages = database.collection<PageDocument>("reflecting.pages");
    this.freshID = freshID;
  }

  async #store<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); }
    catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw error;
      throw new ReflectionUnavailable("Your saved work is temporarily unavailable. Please retry.");
    }
  }

  async createJournal({ user }: { user: string }): Promise<{ journal: string }> {
    const journal = this.freshID();
    try { await this.#store(() => this.journals.insertOne({ _id: user, user, journal })); }
    catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw new JournalCreated("This user already has a journal.");
      throw error;
    }
    return { journal };
  }

  async #journal(user: string) { return this.#store(() => this.journals.findOne({ _id: user })); }
  #validScope({ user, story, chapter }: Scope) { return validReference(user) && validReference(story) && validChapter(chapter); }
  #validFilter({ user, story, chapter }: Filter) { return validReference(user) && (story === undefined || validReference(story)) && (chapter === undefined || validChapter(chapter)); }
  #key({ user, story, chapter }: Scope) { return JSON.stringify([user, story, String(chapter)]); }

  async #content(text: string, images: string[]): Promise<{ text: string; images: string[] }> {
    if (typeof text !== "string") throw new SaveNoEntry("Add a reflection or photo before saving.");
    const cleaned = text.trim();
    if (cleaned.length > REFLECTION_LIMITS.maxTextCharacters) throw new SaveTextTooLong("Keep your reflection within 5,000 characters.");
    if (!Array.isArray(images)) throw new SaveInvalidImage("Choose valid JPEG, PNG, or WebP photos.");
    if (images.length > 3) throw new SaveTooManyImages("Choose up to three photos.");
    const decoded: { bytes: Buffer; format: string }[] = [];
    for (const image of images) {
      if (typeof image !== "string") throw new SaveInvalidImage("Choose valid JPEG, PNG, or WebP photos.");
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]*={0,2})$/.exec(image);
      if (!match || !match[2] || match[2].length % 4 !== 0) throw new SaveInvalidImage("Choose valid JPEG, PNG, or WebP photos.");
      const encoded = match[2];
      const decodedBytes = encoded.length / 4 * 3 - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
      if (decodedBytes > REFLECTION_LIMITS.maxImageBytes) throw new SaveImageTooLarge("Choose photos of at most 1 MB each.");
      const bytes = Buffer.from(encoded, "base64");
      if (bytes.length > REFLECTION_LIMITS.maxImageBytes) throw new SaveImageTooLarge("Choose photos of at most 1 MB each.");
      if (bytes.toString("base64") !== encoded) throw new SaveInvalidImage("Choose valid JPEG, PNG, or WebP photos.");
      decoded.push({ bytes, format: match[1]! });
    }
    for (const { bytes, format } of decoded) {
      try {
        // Decoders can tolerate a missing terminal marker after valid pixels; require complete containers too.
        if (format === "png") {
          if (!bytes.subarray(-12).equals(Buffer.from("0000000049454e44ae426082", "hex"))) throw new Error("Incomplete PNG.");
          for (let offset = 8; offset < bytes.length;) {
            if (offset + 12 > bytes.length) throw new Error("Invalid PNG container.");
            const length = bytes.readUInt32BE(offset);
            if (offset + 12 + length > bytes.length) throw new Error("Invalid PNG chunk.");
            if (bytes.toString("ascii", offset + 4, offset + 8) === "acTL") throw new Error("Animated PNG is unsupported.");
            offset += 12 + length;
          }
        }
        if (format === "jpeg" && !bytes.subarray(-2).equals(Buffer.from([0xff, 0xd9]))) throw new Error("Incomplete JPEG.");
        if (format === "webp") {
          if (bytes.length < 12 || bytes.readUInt32LE(4) + 8 !== bytes.length) throw new Error("Incomplete WebP.");
          for (let offset = 12; offset < bytes.length;) {
            if (offset + 8 > bytes.length) throw new Error("Invalid WebP container.");
            const kind = bytes.toString("ascii", offset, offset + 4);
            const length = bytes.readUInt32LE(offset + 4);
            if (kind === "ANIM" || kind === "ANMF") throw new Error("Animated WebP is unsupported.");
            offset += 8 + length + (length % 2);
            if (offset > bytes.length) throw new Error("Invalid WebP chunk.");
          }
        }
        const image = sharp(bytes, { failOn: "warning", limitInputPixels: 16_000_000 });
        const metadata = await image.metadata();
        if (metadata.format !== format || !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1 || metadata.width * metadata.height > 16_000_000) throw new Error("Invalid image format or dimensions.");
        await image.raw().toBuffer();
      } catch { throw new SaveInvalidImage("Choose valid JPEG, PNG, or WebP photos."); }
    }
    if (!cleaned && !images.length) throw new SaveNoEntry("Add a reflection or photo before saving.");
    return { text: cleaned, images: [...images] };
  }

  async save(input: Scope & { text: string; images: string[] }): Promise<{ page: string }> {
    if (!this.#validScope(input)) throw new SaveInvalidReference("This story or chapter reference is invalid.");
    const content = await this.#content(input.text, input.images);
    const journal = await this.#store(() => this.journals.findOneAndUpdate(
      { _id: input.user }, { $setOnInsert: { user: input.user, journal: this.freshID() } }, { upsert: true, returnDocument: "after" },
    ));
    if (!journal) throw new ReflectionUnavailable("Your saved work is temporarily unavailable. Please retry.");
    const saved = await this.#store(() => this.pages.findOneAndUpdate(
      { _id: this.#key(input) },
      { $set: content, $setOnInsert: { page: this.freshID(), user: input.user, journal: journal.journal, story: input.story, chapter: String(input.chapter) } },
      { upsert: true, returnDocument: "after" },
    ));
    if (!saved) throw new ReflectionUnavailable("Your saved work is temporarily unavailable. Please retry.");
    return { page: saved.page };
  }

  async get(input: Scope): Promise<{ entry: PageRow | null }> {
    if (!this.#validScope(input)) throw new GetInvalidReference("This story or chapter reference is invalid.");
    const row = await this.#store(() => this.pages.findOne({ _id: this.#key(input), user: input.user }));
    return { entry: row ? pageRecord(row) : null };
  }

  async write(input: Scope & { text: string; images?: string[] }): Promise<{ page: string }> {
    const journal = await this.#journal(input.user);
    if (!journal) throw new WriteNoJournal("This user does not have a journal yet.");
    let content;
    try {
      if (!this.#validScope(input)) throw new Error("Invalid reference");
      content = await this.#content(input.text, input.images ?? []);
    } catch { throw new WriteInvalidEntry("Supply valid chapter work with text or up to three supported photos."); }
    const page = this.freshID();
    try { await this.#store(() => this.pages.insertOne({ _id: this.#key(input), page, user: input.user, journal: journal.journal, story: input.story, chapter: String(input.chapter), ...content })); }
    catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) throw new PageAlreadyExists("This journal already has a page for this story and chapter.");
      throw error;
    }
    return { page };
  }

  async edit(input: { user: string; chapter: string | number; text: string; story?: string; images?: string[] }): Promise<{ page: string }> {
    if (!await this.#journal(input.user)) throw new EditNoJournal("This user does not have a journal yet.");
    if (!this.#validFilter(input)) throw new EditInvalidReference("This story or chapter reference is invalid.");
    const rows = await this._page(input);
    if (!rows.length) throw new EditNoPage("The page you want to edit could not be found.");
    if (rows.length > 1) throw new EditAmbiguousPage("Specify the story for this chapter.");
    const row = rows[0]!;
    let content;
    try { content = await this.#content(input.text, input.images ?? row.images); }
    catch { throw new EditInvalidEntry("Supply text or up to three supported photos within the limits."); }
    await this.#store(() => this.pages.updateOne({ _id: this.#key({ user: input.user, story: row.story, chapter: row.chapter }), user: input.user, page: row.page }, { $set: content }));
    return { page: row.page };
  }

  async read(input: Filter): Promise<{ page: string }> {
    if (!await this.#journal(input.user)) throw new ReadNoJournal("This user does not have a journal yet.");
    if (!this.#validFilter(input)) throw new ReadInvalidReference("This story or chapter reference is invalid.");
    const rows = input.story === undefined && input.chapter === undefined ? [] : await this._page(input);
    if (!rows.length) {
      if (input.story !== undefined) throw new ReadNoStory("This user does not have an entry for this story.");
      throw new ReadNoPage("The page you want to read could not be found.");
    }
    if (rows.length > 1) throw new ReadAmbiguousPage("Specify both story and chapter.");
    return { page: rows[0]!.page };
  }

  async getJournal({ user }: { user: string }): Promise<{ pages: PageRow[] }> {
    if (!await this.#journal(user)) throw new GetJournalNotFound("This user does not have a journal yet.");
    const pages = await this._pages({ user });
    pages.sort((a, b) => {
      const numeric = a.chapter.trim() !== "" && b.chapter.trim() !== "" && Number.isFinite(Number(a.chapter)) && Number.isFinite(Number(b.chapter));
      return (numeric ? Number(a.chapter) - Number(b.chapter) : a.chapter.localeCompare(b.chapter)) || a.story.localeCompare(b.story) || a.page.localeCompare(b.page);
    });
    return { pages };
  }
  async _journal({ user }: { user: string }): Promise<JournalRow[]> {
    const row = await this.#journal(user);
    return row ? [{ journal: row.journal, user: row.user }] : [];
  }
  async _page(input: Filter): Promise<PageRow[]> {
    const rows = await this.#store(() => this.pages.find({ user: input.user, ...(input.story === undefined ? {} : { story: input.story }), ...(input.chapter === undefined ? {} : { chapter: String(input.chapter) }) }).sort({ page: 1 }).toArray());
    return rows.map(pageRecord);
  }
  async _pages({ user }: { user: string }): Promise<PageRow[]> { return this._page({ user }); }
}
