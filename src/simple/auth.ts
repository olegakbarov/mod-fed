import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { jwtSecret } from './config';

export interface TokenPayload {
  userId: string;
  iat?: number;
  exp?: number;
}

/**
 * Creates a JWT token for the given user ID.
 * Token expires in 24 hours by default.
 */
export function createToken(userId: string, expiresIn: string = '24h'): string {
  return jwt.sign({ userId }, jwtSecret, { expiresIn });
}

/**
 * Verifies a JWT token and returns the payload.
 * Returns null if the token is invalid or expired.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, jwtSecret) as TokenPayload;
    return decoded;
  } catch (error) {
    // Token is invalid, expired, or malformed
    return null;
  }
}

/**
 * Express middleware to authenticate requests using JWT tokens.
 * Expects the token in the Authorization header as "Bearer <token>".
 * Adds the userId to req.user if authentication succeeds.
 */
export function authenticate(req: Request & { user?: { userId: string } }, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  const payload = verifyToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }

  // Attach user info to request
  req.user = { userId: payload.userId };
  next();
}