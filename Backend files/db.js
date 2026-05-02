import { MongoClient } from "mongodb";
import { DB_NAME } from "./constants.js";

const ensureMongoParams = (url) => {
  if (typeof url !== "string") return url;
  if (!url.startsWith("mongodb://") && !url.startsWith("mongodb+srv://")) {
    return url;
  }
  const [base, query] = url.split("?");
  const params = new URLSearchParams(query || "");

  if (!params.has("retryWrites")) params.set("retryWrites", "true");
  if (!params.has("w")) params.set("w", "majority");
  if (!params.has("tls") && !params.has("ssl")) params.set("tls", "true");

  const paramString = params.toString();
  return paramString ? `${base}?${paramString}` : base;
};

const mongoUrl = ensureMongoParams(
  process.env.MONGO_URL || "mongodb://localhost:27017",
);
export const client = new MongoClient(mongoUrl);

export async function connectDb() {
  try {
    await client.connect();
    await client
      .db(DB_NAME)
      .collection("tokenBlacklist")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await client
      .db(DB_NAME)
      .collection("locks")
      .createIndex({ name: 1 }, { unique: true });
    await client
      .db(DB_NAME)
      .collection("locks")
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await client
      .db(DB_NAME)
      .collection("templates")
      .createIndex(
        { nameNormalized: 1 },
        {
          unique: true,
          partialFilterExpression: { nameNormalized: { $type: "string" } },
        },
      );
    await client
      .db(DB_NAME)
      .collection("userAdStats")
      .createIndex({ userId: 1 }, { unique: true });
    await client
      .db(DB_NAME)
      .collection("ads")
      .createIndex({ isActive: 1, priority: -1 });
    await client
      .db(DB_NAME)
      .collection("adAnalytics")
      .createIndex({ adId: 1 }, { unique: true });
    await client
      .db(DB_NAME)
      .collection("reports")
      .createIndex({ status: 1, createdAt: -1 });
    await client
      .db(DB_NAME)
      .collection("reports")
      .createIndex({ type: 1, targetId: 1, createdAt: -1 });
    await client
      .db(DB_NAME)
      .collection("adminActionLogs")
      .createIndex({ actorId: 1, timestamp: -1 });
    await client
      .db(DB_NAME)
      .collection("moderatorActionLogs")
      .createIndex({ actorId: 1, timestamp: -1 });

    // Card engine indexes
    await client
      .db(DB_NAME)
      .collection("cards")
      .createIndex({ slug: 1 }, { unique: true });
    await client
      .db(DB_NAME)
      .collection("cards")
      .createIndex({ userId: 1, createdAt: -1 });
    await client
      .db(DB_NAME)
      .collection("cards")
      .createIndex({ type: 1, tier: 1 });

    // World chat indexes
    await client
      .db(DB_NAME)
      .collection("worldMessages")
      .createIndex({ createdAt: -1 });
    await client
      .db(DB_NAME)
      .collection("worldMessages")
      .createIndex({ userId: 1, createdAt: -1 });

    console.log("Connected to MongoDB successfully!");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err;
  }
}

export function getDb() {
  return client.db(DB_NAME);
}
