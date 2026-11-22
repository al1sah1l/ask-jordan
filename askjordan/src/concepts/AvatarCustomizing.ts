import { MongoServerError, type Collection, type Db } from "mongodb";

export class AlreadyHolds extends Error {}
export class InvalidSlot extends Error {}
export class NotHolding extends Error {}
export class NotWearing extends Error {}
export class NoHoldings extends Error {}

export type Slot = "HEAD" | "BODY";

interface Holding {
  _id: string;
  user: string;
  item: string;
}

interface Worn {
  _id: string;
  user: string;
  slot: Slot;
  item: string;
}

const SLOTS = new Set<Slot>(["HEAD", "BODY"]);

export class AvatarCustomizingConcept {
  private readonly holdings: Collection<Holding>;
  private readonly worn: Collection<Worn>;

  constructor(db: Db) {
    this.holdings = db.collection<Holding>("avatarcustomizing.holdings");
    this.worn = db.collection<Worn>("avatarcustomizing.worn");
  }

  async grant({ user, item }: { user: string; item: string }) {
    try {
      await this.holdings.insertOne({ _id: `${user}:${item}`, user, item });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new AlreadyHolds("That item has already been granted.");
      }
      throw error;
    }
    return { user, item };
  }

  async equip({ user, item, slot }: { user: string; item: string; slot: string }) {
    const wearing = this.#slot(slot);
    const held = await this.holdings.findOne({ _id: `${user}:${item}` });
    if (!held) throw new NotHolding("That item has not been granted.");
    await this.worn.deleteMany({ user, item });
    await this.worn.updateOne(
      { _id: `${user}:${wearing}` },
      { $set: { user, slot: wearing, item } },
      { upsert: true },
    );
    return { user, slot: wearing, item };
  }

  async clear({ user, slot }: { user: string; slot: string }) {
    const wearing = this.#slot(slot);
    const removed = await this.worn.deleteOne({ _id: `${user}:${wearing}` });
    if (removed.deletedCount === 0) throw new NotWearing("Nothing is worn in that slot.");
    return { user, slot: wearing };
  }

  async getEquipped({ user }: { user: string }) {
    const holdings = await this.holdings.countDocuments({ user });
    if (holdings === 0) {
      throw new NoHoldings("Nothing has been granted, so there is nothing to wear.");
    }
    const rows = await this.worn.find({ user }).sort({ slot: 1 }).toArray();
    return { worn: rows.map(({ slot, item }) => ({ slot, item })) };
  }

  #slot(slot: string): Slot {
    if (!SLOTS.has(slot as Slot)) {
      throw new InvalidSlot("An item can be worn only on the head or the body.");
    }
    return slot as Slot;
  }
}
