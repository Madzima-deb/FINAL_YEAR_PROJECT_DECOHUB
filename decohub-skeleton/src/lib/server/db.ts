import initSqlJs, { type Database } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Resolve project root relative to this file (src/lib/server/db.ts → project root)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

const DB_PATH = path.join(PROJECT_ROOT, 'data', 'decohub.db');

// Ensure the data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

let db: Database;

/**
 * Initialize the database (lazy singleton).
 * sql.js init is async (loads WASM), so all callers must await this.
 */
async function initDb(): Promise<Database> {
	if (db) return db;

	const SQL = await initSqlJs();

	// Load existing DB file if present, otherwise create fresh
	if (fs.existsSync(DB_PATH)) {
		const fileBuffer = fs.readFileSync(DB_PATH);
		db = new SQL.Database(fileBuffer);
	} else {
		db = new SQL.Database();
	}

	// Create users table if it doesn't exist
	db.run(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT,
			provider TEXT NOT NULL DEFAULT 'email',
			provider_id TEXT,
			avatar_url TEXT,
			created_at TEXT NOT NULL DEFAULT (datetime('now'))
		)
	`);

	// ── Migrations for existing DBs ─────────────────────────────────────────
	// sql.js doesn't support ALTER TABLE … ADD COLUMN IF NOT EXISTS,
	// so we use try/catch to silently skip columns that already exist.
	const migrations = [
		"ALTER TABLE users ADD COLUMN provider TEXT NOT NULL DEFAULT 'email'",
		'ALTER TABLE users ADD COLUMN provider_id TEXT',
		'ALTER TABLE users ADD COLUMN avatar_url TEXT'
	];
	for (const sql of migrations) {
		try { db.run(sql); } catch { /* column already exists — ignore */ }
	}

	// Seed demo accounts for testing if not present
	const checkDemo = db.exec("SELECT id FROM users WHERE email = 'demo@decohub.com'");
	if (checkDemo.length === 0 || checkDemo[0].values.length === 0) {
		db.run(
			"INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
			['Demo User', 'demo@decohub.com', '$2b$10$bvzg91X9sGgQZYcjNIBg5OezjzcvrwmquI6eLn0A21jwY.SjZFhie']
		);
	}

	const checkAdmin = db.exec("SELECT id FROM users WHERE email = 'admin@decohub.com'");
	if (checkAdmin.length === 0 || checkAdmin[0].values.length === 0) {
		db.run(
			"INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
			['Admin User', 'admin@decohub.com', '$2b$10$/4ZUpVmiaQKwpifs4ZNuUu043htfsYIjWubgi8lEab.C5H5.WHsj6']
		);
	}

	// Persist after schema creation and seed
	saveDb();

	return db;
}

/**
 * Write current DB state to disk.
 */
function saveDb(): void {
	if (!db) return;
	const data = db.export();
	const buffer = Buffer.from(data);
	fs.writeFileSync(DB_PATH, buffer);
}

export { initDb, saveDb };
export type { Database };
