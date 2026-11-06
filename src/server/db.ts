import mongoose from "mongoose";

// One cached connection, reused across hot reloads and serverless calls.
// Nothing connects at import time, so the site builds fine without MONGODB_URI.
const g = globalThis as unknown as { _mongo?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } };
const cache = (g._mongo ??= { conn: null, promise: null });

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local (see .env.example).");
  if (cache.conn) return cache.conn;
  cache.promise ??= mongoose.connect(uri, { dbName: process.env.MONGODB_DB || "turturesmp", bufferCommands: false });
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
}

// Model helper: returns the existing model on hot reload instead of redefining it.
export function model<T>(name: string, schema: mongoose.Schema<T>) {
  return (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);
}
