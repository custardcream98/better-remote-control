import crypto from "node:crypto";

import type { Request, Response, NextFunction } from "express";

/** Generate a random password (6-char hex) */
export function generatePassword(): string {
  return crypto.randomBytes(3).toString("hex");
}

/** Timing-safe string comparison */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Hash password (for cookie token) */
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/** Express middleware: cookie-based auth */
export function authMiddleware(password: string) {
  const TOKEN = hashPassword(password);

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path === "/login" || req.path === "/api/login") {
      next();
      return;
    }

    const cookie = req.headers.cookie ?? "";
    const tokenMatch = cookie.match(/brc_token=([^;]+)/);
    if (tokenMatch && safeEqual(tokenMatch[1], TOKEN)) {
      next();
      return;
    }

    res.redirect("/login");
  };
}

/** Verify WebSocket auth token */
export function verifyWsToken(cookie: string | undefined, password: string): boolean {
  if (!cookie) return false;
  const TOKEN = hashPassword(password);
  const tokenMatch = cookie.match(/brc_token=([^;]+)/);
  if (!tokenMatch) return false;
  return safeEqual(tokenMatch[1], TOKEN);
}

/** Compare passwords (timing-safe) */
export function verifyPassword(input: string, password: string): boolean {
  return safeEqual(hashPassword(input), hashPassword(password));
}

// Rate limiting
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1 minute

export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}
