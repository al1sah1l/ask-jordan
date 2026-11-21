import { MongoServerError, type Collection, type Db } from "mongodb";

export class BlankName extends Error {}
export class ProfileExists extends Error {}
export class NoProfile extends Error {}

interface Profile {
  _id: string;
  name: string;
  about: string;
}

export class AccountConcept {
  private readonly profiles: Collection<Profile>;

  constructor(db: Db) {
    this.profiles = db.collection<Profile>("account.profiles");
  }

  async createAccount({ user, name, about }: { user: string; name: string; about: string }) {
    if (name.trim() === "") throw new BlankName("A display name is required.");
    try {
      await this.profiles.insertOne({ _id: user, name, about });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw new ProfileExists("That user already has a profile.");
      }
      throw error;
    }
    return { profile: user };
  }

  async updateProfile({ user, name, about }: { user: string; name: string; about: string }) {
    await this.#profile(user);
    if (name.trim() === "") throw new BlankName("A display name is required.");
    await this.profiles.updateOne({ _id: user }, { $set: { name, about } });
    return { profile: user };
  }

  async getProfile({ user }: { user: string }) {
    const found = await this.#profile(user);
    return { profile: found._id, name: found.name, about: found.about };
  }

  async #profile(user: string): Promise<Profile> {
    const found = await this.profiles.findOne({ _id: user });
    if (!found) throw new NoProfile("That user has no profile.");
    return found;
  }
}
