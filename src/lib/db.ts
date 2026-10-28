import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { seed } from "./desk/seed";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL, department TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, body TEXT NOT NULL, keywords TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
  category TEXT NOT NULL, priority TEXT NOT NULL, status TEXT NOT NULL,
  requester_id TEXT NOT NULL REFERENCES employees(id),
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, resolved_at TEXT,
  idempotency_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_tickets_requester ON tickets(requester_id);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id), title TEXT NOT NULL,
  status TEXT NOT NULL, analyst_id TEXT, handoff_summary TEXT,
  draft_json TEXT, draft_turn INTEGER,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id),
  role TEXT NOT NULL, content TEXT NOT NULL, parts TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
`;

function open(): Database.Database {
  const file = process.env.DATABASE_PATH ?? "./data/nexo.db";
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(/*turbopackIgnore: true*/ file)), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) n FROM employees").get() as { n: number };
  if (n === 0) seed(db);
  return db;
}

const g = globalThis as unknown as { __nexoDb?: Database.Database };
export const getDb = (): Database.Database => (g.__nexoDb ??= open());
