// Simple client-side security helpers for demo/offline mode.
// NOTE: For real-world security, authentication must be done server-side.

import type { User } from '../types';

const textEncoder = new TextEncoder();

async function sha256Hex(input: string): Promise<string> {
  const data = textEncoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(storeId: string, email: string, password: string): Promise<string> {
  // Store-scoped salt to avoid same password → same hash across stores
  const normalizedEmail = email.trim().toLowerCase();
  return sha256Hex(`lumina|${storeId}|${normalizedEmail}|${password}`);
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  if (user.passwordHash) {
    const computed = await hashPassword(user.storeId, user.email, password);
    return computed === user.passwordHash;
  }
  // Legacy fallback
  return (user.password || '') === password;
}

export async function migrateUsersToPasswordHash(users: User[]): Promise<User[]> {
  const migrated: User[] = [];

  for (const u of users) {
    if (u.passwordHash) {
      migrated.push(u);
      continue;
    }
    if (u.password) {
      const passwordHash = await hashPassword(u.storeId, u.email, u.password);
      migrated.push({ ...u, passwordHash, password: undefined });
      continue;
    }
    migrated.push(u);
  }

  return migrated;
}

