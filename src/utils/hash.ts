import { createHash } from 'crypto';

export function sha256(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

export function sha1(data: Buffer | string): string {
  return createHash('sha1').update(data).digest('hex');
}

export function shortHash(data: Buffer | string, length = 12): string {
  return sha256(data).substring(0, length);
}
