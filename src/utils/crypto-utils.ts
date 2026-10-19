import * as crypto from 'crypto';

/**
 * Pure logic cryptography utility
 *
 * Constitution requirement: MUST NOT import vscode module
 * Uses Node.js built-in crypto module
 */

/**
 * Generate random bytes hex string
 * @param length - Number of bytes (default: 16 for 128-bit)
 * @returns Hex string of random bytes
 */
export function generateRandomHex(length: number = 16): string {
 return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate random bytes base64 string
 * @param length - Number of bytes (default: 16 for 128-bit)
 * @returns Base64 string of random bytes
 */
export function generateRandomBase64(length: number = 16): string {
 return crypto.randomBytes(length).toString('base64');
}

/**
 * Generate SHA-256 hash of input
 * @param input - String to hash
 * @returns Hex string hash
 */
export function sha256(input: string): string {
 return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generate SHA-512 hash of input
 * @param input - String to hash
 * @returns Hex string hash
 */
export function sha512(input: string): string {
 return crypto.createHash('sha512').update(input).digest('hex');
}

/**
 * Generate a unique ID (v4 UUID)
 * @returns UUID v4 as string
 */
export function generateUUID(): string {
 return crypto.randomUUID();
}

/**
 * Generate a short unique ID (base64url, 16 bytes = 128-bit of entropy)
 * @returns Short ID as base64url string (no padding)
 */
export function generateShortId(): string {
 return crypto.randomBytes(16).toString('base64url');
}

/**
 * Hash sensitive data with salt for storage
 * @param data - Sensitive data to hash
 * @param salt - Salt for hashing
 * @returns Salted hash as hex string
 */
export function hashWithSalt(data: string, salt: string): string {
 return crypto.createHash('sha256').update(`${salt}${data}`).digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks
 * @param a - First value
 * @param b - Second value
 * @returns True if equal
 */
export function constantTimeEqual(a: Buffer | string, b: Buffer | string): boolean {
 const bufA = typeof a === 'string' ? Buffer.from(a, 'utf8') : a;
 const bufB = typeof b === 'string' ? Buffer.from(b, 'utf8') : b;

 if (bufA.length !== bufB.length) {
  return false;
 }

 return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate HMAC-SHA256 signature
 * @param data - Data to sign
 * @param secret - Secret key
 * @returns HMAC signature as hex string
 */
export function hmacSha256(data: string, secret: string): string {
 return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Encode to base64url (URL-safe base64 without padding)
 * @param input - String to encode
 * @returns Base64url string
 */
export function base64urlEncode(input: string): string {
 return Buffer.from(input, 'utf8').toString('base64url');
}

/**
 * Decode from base64url
 * @param input - Base64url string to decode
 * @returns Decoded string
 */
export function base64urlDecode(input: string): string {
 return Buffer.from(input, 'base64url').toString('utf8');
}
