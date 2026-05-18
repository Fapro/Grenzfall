import { NextFunction, Request, Response } from 'express';
import { findSession, findTenantBySlug, findUserById, touchSession } from '../multitenant/store';
import { Tenant, User } from '../multitenant/types';

declare global {
  namespace Express {
    interface Request {
      currentUser?: User;
      currentTenant?: Tenant;
    }
  }
}

function parseHost(host: string): string {
  return host.toLowerCase().split(':')[0] ?? '';
}

function extractSlugFromHost(host: string, rootDomain: string): string | null {
  if (!rootDomain) {
    return null;
  }

  const root = rootDomain.toLowerCase();
  if (!host.endsWith(`.${root}`)) {
    return null;
  }

  const suffixIndex = host.length - root.length - 1;
  const subdomainPart = host.slice(0, suffixIndex);
  const parts = subdomainPart.split('.').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

export function authSessionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) {
    next();
    return;
  }

  const session = findSession(token);
  if (!session) {
    next();
    return;
  }

  const user = findUserById(session.userId);
  if (!user) {
    next();
    return;
  }

  touchSession(token);
  req.currentUser = user;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.currentUser) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function tenantResolutionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const host = parseHost(req.headers.host ?? '');
  const rootDomain = (process.env.ROOT_DOMAIN ?? '').trim();

  let slug: string | null = null;
  if (host) {
    slug = extractSlugFromHost(host, rootDomain);
  }

  if (!slug) {
    const headerSlug = String(req.headers['x-tenant-slug'] ?? '').trim().toLowerCase();
    if (headerSlug) slug = headerSlug;
  }

  if (!slug && typeof req.query.tenant === 'string') {
    slug = req.query.tenant.trim().toLowerCase();
  }

  if (!slug) {
    next();
    return;
  }

  const tenant = findTenantBySlug(slug);
  if (tenant) {
    req.currentTenant = tenant;
  }
  next();
}

export function requireTenant(req: Request, res: Response, next: NextFunction): void {
  if (!req.currentTenant) {
    res.status(404).json({ error: 'Tenant not found for this request' });
    return;
  }
  next();
}
