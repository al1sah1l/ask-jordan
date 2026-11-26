import { MongoServerError, type Collection, type Db } from "mongodb";

export class InvalidUsername extends Error {}
export class InvalidEmail extends Error {}
export class WeakPassword extends Error {}
export class UsernameTaken extends Error {}
export class EmailTaken extends Error {}
export class InvalidCredentials extends Error {}
export class InvalidRecovery extends Error {}

/** An account is identified by its username, which is also its `_id`. */
interface Account {
  _id: string;
  email: string;
  passwordVerifier: string;
}

interface Recovery {
  _id: string;
  account: string;
  createdAt: Date;
  expiresAt: Date;
}

const USERNAME = /^[A-Za-z0-9_-]{3,32}$/;
const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const RECOVERY_MS = 5 * 60 * 1000;
const RECOVERY_COOLDOWN_MS = 60 * 1000;

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 254 || !EMAIL.test(normalized)) return null;
  return normalized;
}

function hashToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

function duplicateField(error: MongoServerError): string | undefined {
  const pattern = error.keyPattern;
  return pattern ? Object.keys(pattern)[0] : undefined;
}

export class AuthenticatingConcept {
  private readonly accounts: Collection<Account>;
  private readonly recoveries: Collection<Recovery>;
  private readonly ready: Promise<void>;

  constructor(
    db: Db,
    private readonly clock: () => Date = () => new Date(),
  ) {
    this.accounts = db.collection<Account>("authenticating.accounts");
    this.recoveries = db.collection<Recovery>("authenticating.recoveries");
    this.ready = Promise.all([
      this.accounts.createIndex(
        { email: 1 },
        {
          unique: true,
          partialFilterExpression: { email: { $type: "string" } },
          name: "account_email",
        },
      ),
      this.recoveries.createIndex(
        { expiresAt: 1 },
        { expireAfterSeconds: 0, name: "recovery_expiry" },
      ),
    ]).then(() => undefined);
  }

  async register({ username, email, password }: { username: string; email: string; password: string }) {
    await this.ready;
    if (!USERNAME.test(username)) {
      throw new InvalidUsername(
        "A username must contain 3 to 32 letters, numbers, underscores, or hyphens.",
      );
    }
    const normalized = normalizeEmail(email);
    if (!normalized) throw new InvalidEmail("Enter a valid email address.");
    if (password.length < 8 || password.length > 128) {
      throw new WeakPassword("A password must contain 8 to 128 characters.");
    }
    // Bun.password.hash salts the password and keeps the salt inside the verifier.
    const passwordVerifier = await Bun.password.hash(password);
    try {
      await this.accounts.insertOne({ _id: username, email: normalized, passwordVerifier });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        if (duplicateField(error) === "email") throw new EmailTaken("That email is already registered.");
        throw new UsernameTaken("That username is already registered.");
      }
      throw error;
    }
    return { account: username };
  }

  async authenticate({ username, password }: { username: string; password: string }) {
    await this.ready;
    const found = await this.accounts.findOne({ _id: username });
    if (!found || !(await Bun.password.verify(password, found.passwordVerifier))) {
      throw new InvalidCredentials("The username or password is incorrect.");
    }
    return { account: found._id };
  }

  /**
   * An empty token means no mail should be sent. That covers an unknown email
   * and a second request inside the cooldown, without saying which one it was.
   */
  async requestRecovery({ email }: { email: string }) {
    await this.ready;
    const normalized = normalizeEmail(email);
    if (!normalized) throw new InvalidEmail("Enter a valid email address.");
    const found = await this.accounts.findOne({ email: normalized });
    if (!found) return { token: "" };

    const now = this.clock();
    const current = await this.recoveries.findOne({ account: found._id, expiresAt: { $gt: now } });
    if (current && now.getTime() - current.createdAt.getTime() < RECOVERY_COOLDOWN_MS) {
      return { token: "" };
    }

    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
    await this.recoveries.deleteMany({ account: found._id });
    await this.recoveries.insertOne({
      _id: hashToken(token),
      account: found._id,
      createdAt: now,
      expiresAt: new Date(now.getTime() + RECOVERY_MS),
    });
    return { token };
  }

  async resetPassword({ token, password }: { token: string; password: string }) {
    await this.ready;
    if (typeof token !== "string" || token.length < 20 || token.length > 200) {
      throw new InvalidRecovery("That reset link is invalid or has expired.");
    }
    const found = await this.recoveries.findOne({ _id: hashToken(token) });
    if (!found || found.expiresAt <= this.clock()) {
      if (found) await this.recoveries.deleteOne({ _id: found._id });
      throw new InvalidRecovery("That reset link is invalid or has expired.");
    }
    if (password.length < 8 || password.length > 128) {
      throw new WeakPassword("A password must contain 8 to 128 characters.");
    }
    const passwordVerifier = await Bun.password.hash(password);
    await this.accounts.updateOne({ _id: found.account }, { $set: { passwordVerifier } });
    await this.recoveries.deleteMany({ account: found.account });
    return { account: found.account };
  }
}
