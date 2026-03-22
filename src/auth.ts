import crypto from "node:crypto";

import type { Request, Response, NextFunction } from "express";

/** 랜덤 비밀번호 생성 (6자리 영숫자) */
export function generatePassword(): string {
  return crypto.randomBytes(3).toString("hex");
}

/** timing-safe 문자열 비교 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** 비밀번호 해시 생성 (쿠키용) */
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

/** Express 미들웨어: 쿠키 기반 인증 */
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

/** WebSocket 인증 확인 */
export function verifyWsToken(cookie: string | undefined, password: string): boolean {
  if (!cookie) return false;
  const TOKEN = hashPassword(password);
  const tokenMatch = cookie.match(/brc_token=([^;]+)/);
  if (!tokenMatch) return false;
  return safeEqual(tokenMatch[1], TOKEN);
}

/** 비밀번호 비교 (timing-safe) */
export function verifyPassword(input: string, password: string): boolean {
  return safeEqual(hashPassword(input), hashPassword(password));
}

// Rate limiting
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000; // 1분

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
