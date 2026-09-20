import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { initDb, saveDb } from './db.js';

// ── Constants ────────────────────────────────────────────────────────────────

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'decohub_dev_secret_change_in_production';
const JWT_EXPIRES_IN = '7d';

export const SESSION_COOKIE_NAME = 'decohub_session';

export const COOKIE_OPTIONS = {
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: 'lax' as const,
	path: '/',
	maxAge: 60 * 60 * 24 * 7 // 7 days in seconds
};

// ── Types ────────────────────────────────────────────────────────────────────

export type UserProvider = 'email' | 'google' | 'apple';

export interface UserRecord {
	id: number;
	name: string;
	email: string;
	password_hash: string | null;
	provider: UserProvider;
	provider_id: string | null;
	avatar_url: string | null;
	created_at: string;
}

export interface UserPayload {
	id: number;
	name: string;
	email: string;
	avatar_url?: string | null;
}

// ── User CRUD ────────────────────────────────────────────────────────────────

export async function createUser(
	name: string,
	email: string,
	password: string
): Promise<UserPayload> {
	const db = await initDb();
	const hash = await bcrypt.hash(password, SALT_ROUNDS);
	const normalizedEmail = email.toLowerCase().trim();

	// Check uniqueness first (sql.js doesn't throw typed constraint errors)
	const existing = db.exec('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
	if (existing.length > 0 && existing[0].values.length > 0) {
		const err = new Error('UNIQUE constraint failed: users.email');
		(err as any).code = 'SQLITE_CONSTRAINT_UNIQUE';
		throw err;
	}

	db.run(
		"INSERT INTO users (name, email, password_hash, provider) VALUES (?, ?, ?, 'email')",
		[name, normalizedEmail, hash]
	);

	// Get the inserted row's ID
	const result = db.exec('SELECT last_insert_rowid() as id');
	const id = result[0].values[0][0] as number;

	// Persist to disk
	saveDb();

	return { id, name, email: normalizedEmail };
}

export async function verifyUser(
	email: string,
	password: string
): Promise<UserPayload | null> {
	const db = await initDb();
	const normalizedEmail = email.toLowerCase().trim();

	const result = db.exec(
		'SELECT id, name, email, password_hash FROM users WHERE email = ? AND provider = \'email\'',
		[normalizedEmail]
	);

	if (result.length === 0 || result[0].values.length === 0) {
		return null;
	}

	const row = result[0].values[0];
	const user: UserRecord = {
		id: row[0] as number,
		name: row[1] as string,
		email: row[2] as string,
		password_hash: row[3] as string,
		provider: 'email',
		provider_id: null,
		avatar_url: null,
		created_at: ''
	};

	if (!user.password_hash) return null;
	const valid = await bcrypt.compare(password, user.password_hash);
	if (!valid) return null;

	return { id: user.id, name: user.name, email: user.email };
}

// ── Social Login ─────────────────────────────────────────────────────────────

/**
 * Find an existing social user by (provider + provider_id), or create a new
 * user record if none exists. If an email-only account exists with the same
 * address, return it and link the provider (merge).
 */
export async function findOrCreateSocialUser(
	provider: UserProvider,
	providerId: string,
	email: string,
	name: string,
	avatarUrl: string | null
): Promise<UserPayload> {
	const db = await initDb();
	const normalizedEmail = email.toLowerCase().trim();

	// 1. Try to find by provider + provider_id (most reliable — survives email changes)
	const byProvider = db.exec(
		'SELECT id, name, email, avatar_url FROM users WHERE provider = ? AND provider_id = ?',
		[provider, providerId]
	);
	if (byProvider.length > 0 && byProvider[0].values.length > 0) {
		const row = byProvider[0].values[0];
		// Update avatar in case it changed
		db.run('UPDATE users SET avatar_url = ? WHERE id = ?', [avatarUrl, row[0]]);
		saveDb();
		return {
			id: row[0] as number,
			name: row[1] as string,
			email: row[2] as string,
			avatar_url: avatarUrl
		};
	}

	// 2. Try to find by email — link this social provider to the existing account
	const byEmail = db.exec(
		'SELECT id, name, email, provider, avatar_url FROM users WHERE email = ?',
		[normalizedEmail]
	);
	if (byEmail.length > 0 && byEmail[0].values.length > 0) {
		const row = byEmail[0].values[0];
		const existingProvider = row[3] as string;

		// If the existing account has a different social provider, throw a linkable error
		if (existingProvider !== 'email' && existingProvider !== provider) {
			const err = new Error(`Account already exists with provider: ${existingProvider}`);
			(err as any).code = 'PROVIDER_CONFLICT';
			(err as any).existingProvider = existingProvider;
			throw err;
		}

		// Link this provider to the existing account (email or same provider)
		db.run(
			'UPDATE users SET provider = ?, provider_id = ?, avatar_url = ? WHERE id = ?',
			[provider, providerId, avatarUrl ?? row[4], row[0]]
		);
		saveDb();
		return {
			id: row[0] as number,
			name: row[1] as string,
			email: row[2] as string,
			avatar_url: (avatarUrl ?? row[4]) as string | null
		};
	}

	// 3. Brand-new user — create the record
	db.run(
		'INSERT INTO users (name, email, provider, provider_id, avatar_url) VALUES (?, ?, ?, ?, ?)',
		[name, normalizedEmail, provider, providerId, avatarUrl]
	);
	const result = db.exec('SELECT last_insert_rowid() as id');
	const id = result[0].values[0][0] as number;
	saveDb();

	return { id, name, email: normalizedEmail, avatar_url: avatarUrl };
}

// ── JWT Session ──────────────────────────────────────────────────────────────

export function createSessionToken(user: UserPayload): string {
	return jwt.sign(
		{ userId: user.id, email: user.email, name: user.name, avatar_url: user.avatar_url },
		JWT_SECRET,
		{ expiresIn: JWT_EXPIRES_IN }
	);
}

export function verifySessionToken(token: string): UserPayload | null {
	try {
		const decoded = jwt.verify(token, JWT_SECRET) as {
			userId: number;
			email: string;
			name: string;
			avatar_url?: string | null;
		};
		return { id: decoded.userId, name: decoded.name, email: decoded.email, avatar_url: decoded.avatar_url };
	} catch {
		return null;
	}
}

