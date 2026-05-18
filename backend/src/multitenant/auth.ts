import crypto from 'crypto';

const SCRYPT_COST = 64;

const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'mail',
  'support',
  'docs',
  'help',
  'status',
  'cdn',
  'assets',
]);

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function randomToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, SCRYPT_COST, (err, key) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, storedHex] = hash.split(':');
  if (!salt || !storedHex) {
    return false;
  }

  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_COST, (err, key) => {
      if (err) {
        reject(err);
        return;
      }

      const stored = Buffer.from(storedHex, 'hex');
      const incoming = Buffer.from(key);
      if (stored.length !== incoming.length) {
        resolve(false);
        return;
      }
      resolve(crypto.timingSafeEqual(stored, incoming));
    });
  });
}

export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function validateWorkspaceSlug(rawSlug: string): { ok: true; slug: string } | { ok: false; error: string } {
  const slug = slugify(rawSlug);
  if (!slug) {
    return { ok: false, error: 'Workspace slug is required' };
  }
  if (slug.length < 3 || slug.length > 32) {
    return { ok: false, error: 'Workspace slug must be 3-32 chars' };
  }
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
    return { ok: false, error: 'Workspace slug has invalid format' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, error: 'Workspace slug is reserved' };
  }
  return { ok: true, slug };
}
