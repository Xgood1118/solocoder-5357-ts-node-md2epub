import * as https from 'https';
import * as http from 'http';
import * as url from 'url';
import * as path from 'path';
import * as mimeTypes from 'mime-types';
import { Logger } from './logger';
import { readBinaryFile, fileExists } from './file-io';

export interface DownloadedImage {
  data: Buffer;
  mimeType: string;
  extension: string;
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function inferExtensionFromMime(mimeType: string): string {
  const ext = mimeTypes.extension(mimeType);
  if (ext) return ext;
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/svg+xml') return 'svg';
  return 'png';
}

function inferMimeFromExtension(ext: string): string {
  const mime = mimeTypes.lookup(ext);
  if (mime) return mime;
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  return 'image/png';
}

export async function downloadImage(
  imageUrl: string,
  logger: Logger,
  timeoutMs = 15000
): Promise<DownloadedImage | null> {
  return new Promise((resolve) => {
    try {
      const parsed = url.parse(imageUrl);
      const client = parsed.protocol === 'https:' ? https : http;

      const headers: Record<string, string> = {
        'User-Agent': BROWSER_UA,
        Accept: 'image/*,*/*;q=0.8',
      };

      const req = client.get(
        {
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.path,
          headers,
          timeout: timeoutMs,
        },
        (res) => {
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            downloadImage(res.headers.location, logger).then(resolve).catch(() => resolve(null));
            return;
          }

          if (!res.statusCode || res.statusCode >= 400) {
            logger.warn(`Failed to download image ${imageUrl}: HTTP ${res.statusCode || 'unknown'}`);
            resolve(null);
            return;
          }

          const chunks: Buffer[] = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => {
            const data = Buffer.concat(chunks);
            const contentType = res.headers['content-type'] || '';
            const mimeType = contentType.split(';')[0].trim() || inferMimeFromExtension(path.extname(parsed.pathname || '').slice(1));
            const extension = inferExtensionFromMime(mimeType);
            resolve({ data, mimeType, extension });
          });
          res.on('error', (err) => {
            logger.warn(`Error downloading image ${imageUrl}: ${err.message}`);
            resolve(null);
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        logger.warn(`Timeout downloading image ${imageUrl}`);
        resolve(null);
      });

      req.on('error', (err) => {
        logger.warn(`Request error for image ${imageUrl}: ${err.message}`);
        resolve(null);
      });
    } catch (err) {
      logger.warn(`Exception downloading image ${imageUrl}: ${(err as Error).message}`);
      resolve(null);
    }
  });
}

export async function loadLocalImage(
  imagePath: string,
  baseDir: string,
  logger: Logger
): Promise<DownloadedImage | null> {
  try {
    const resolvedPath = path.isAbsolute(imagePath)
      ? imagePath
      : path.resolve(baseDir, imagePath);

    if (!(await fileExists(resolvedPath))) {
      logger.warn(`Local image not found: ${resolvedPath}`);
      return null;
    }

    const data = await readBinaryFile(resolvedPath);
    const ext = path.extname(resolvedPath).toLowerCase().slice(1);
    const mimeType = inferMimeFromExtension(ext);
    return { data, mimeType, extension: ext || inferExtensionFromMime(mimeType) };
  } catch (err) {
    logger.warn(`Error loading local image ${imagePath}: ${(err as Error).message}`);
    return null;
  }
}

export function isRemoteUrl(src: string): boolean {
  return /^https?:\/\//i.test(src);
}
