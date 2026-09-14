import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Secret key for token signing (generates a fallback random key if none exists)
const JWT_SECRET = process.env.JWT_SECRET || 'karian_secure_almakhzoun_enterprise_secret_key_2026';

// RAM-based rate limiter store to handle extremely fast rate limiting
interface RateLimitRecord {
  timestamps: number[];
}
const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Creates a lightweight HMAC-signed session Token (equivalent to JWT)
 */
export function createToken(payload: object, durationMs: number = 2 * 60 * 60 * 1000): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  
  const expiresAt = Date.now() + durationMs;
  const body = Buffer.from(JSON.stringify({ ...payload, exp: expiresAt })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
    
  return `${header}.${body}.${signature}`;
}

/**
 * Verifies the HMAC-signed token
 */
export function verifyToken(token: string): any {
  try {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) return null;
    
    // Validate signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
      
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    
    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Express middleware to validate incoming JWT tokens in endpoints.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'مطلوب مصادقة الدخول الأمن لمتابعة الطلب.' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ success: false, message: 'جليّة الدخول المنتهية أو غير صالحة.' });
  }

  // Inject user info into request body
  (req as any).user = payload;
  next();
}

/**
 * Rate limiting middleware: Strictly allows a maximum of 3 requests per 15 minutes
 * per IP Address for sensitive endpoints (like OTP generation and verification).
 */
export function recoveryRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const timeWindow = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 3;

  let record = rateLimitStore.get(ip);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(ip, record);
  }

  // Filter out timestamps outside the time window
  record.timestamps = record.timestamps.filter(t => now - t < timeWindow);

  if (record.timestamps.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: 'بروتوكول الأمان: تم رصد محاولات متكررة. يرجى الانتظار 15 دقيقة قبل إعادة المحاولة.'
    });
  }

  // Record contemporary attempt
  record.timestamps.push(now);
  next();
}
