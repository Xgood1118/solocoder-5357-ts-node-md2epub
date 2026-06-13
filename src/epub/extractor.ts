import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { Logger } from '../utils/logger';
import { ensureDir } from '../utils/file-io';

const unzip = promisify(zlib.unzip);
const inflateRaw = promisify(zlib.inflateRaw);

interface LocalFileHeader {
  signature: number;
  version: number;
  flags: number;
  compression: number;
  modTime: number;
  modDate: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  nameLength: number;
  extraLength: number;
  name: string;
  dataOffset: number;
}

interface CentralDirectoryEntry {
  signature: number;
  versionMadeBy: number;
  versionNeeded: number;
  flags: number;
  compression: number;
  modTime: number;
  modDate: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  nameLength: number;
  extraLength: number;
  commentLength: number;
  diskNumberStart: number;
  internalAttrs: number;
  externalAttrs: number;
  localHeaderOffset: number;
  name: string;
}

export async function extractEpub(epubPath: string, outputDir: string, logger: Logger): Promise<void> {
  logger.info(`Extracting ${epubPath} to ${outputDir}`);
  await ensureDir(outputDir);

  const buffer = fs.readFileSync(epubPath);
  const entries = parseCentralDirectory(buffer);

  for (const entry of entries) {
    const fileData = extractFileData(buffer, entry, logger);
    const filePath = path.join(outputDir, entry.name);

    if (entry.name.endsWith('/')) {
      await ensureDir(filePath);
    } else {
      await ensureDir(path.dirname(filePath));
      fs.writeFileSync(filePath, fileData);
      logger.verbose(`Extracted: ${entry.name}`);
    }
  }

  logger.info(`Extraction complete. ${entries.length} files extracted.`);
}

function parseCentralDirectory(buffer: Buffer): CentralDirectoryEntry[] {
  const entries: CentralDirectoryEntry[] = [];
  let offset = 0;

  const endSig = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endPos = buffer.lastIndexOf(endSig);
  if (endPos < 0) {
    throw new Error('Not a valid ZIP/EPUB file: missing end of central directory');
  }

  const cdSize = buffer.readUInt32LE(endPos + 12);
  const cdOffset = buffer.readUInt32LE(endPos + 16);

  offset = cdOffset;
  const cdEnd = cdOffset + cdSize;

  while (offset < cdEnd) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      break;
    }

    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const name = buffer.toString('utf-8', offset + 46, offset + 46 + nameLength);

    entries.push({
      signature: buffer.readUInt32LE(offset),
      versionMadeBy: buffer.readUInt16LE(offset + 4),
      versionNeeded: buffer.readUInt16LE(offset + 6),
      flags: buffer.readUInt16LE(offset + 8),
      compression: buffer.readUInt16LE(offset + 10),
      modTime: buffer.readUInt16LE(offset + 12),
      modDate: buffer.readUInt16LE(offset + 14),
      crc32: buffer.readUInt32LE(offset + 16),
      compressedSize: buffer.readUInt32LE(offset + 20),
      uncompressedSize: buffer.readUInt32LE(offset + 24),
      nameLength,
      extraLength,
      commentLength,
      diskNumberStart: buffer.readUInt16LE(offset + 34),
      internalAttrs: buffer.readUInt16LE(offset + 36),
      externalAttrs: buffer.readUInt32LE(offset + 38),
      localHeaderOffset: buffer.readUInt32LE(offset + 42),
      name,
    });

    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function extractFileData(buffer: Buffer, entry: CentralDirectoryEntry, logger: Logger): Buffer {
  const localHeaderOffset = entry.localHeaderOffset;
  const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
  const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
  const compressedData = buffer.slice(dataStart, dataStart + entry.compressedSize);

  try {
    switch (entry.compression) {
      case 0:
        return compressedData;
      case 8:
        return zlib.inflateRawSync(compressedData);
      default:
        logger.warn(`Unsupported compression method ${entry.compression} for ${entry.name}, using raw data`);
        return compressedData;
    }
  } catch (err) {
    logger.error(`Failed to decompress ${entry.name}`, err as Error);
    return compressedData;
  }
}

export interface EpubInfo {
  metadata: Record<string, string>;
  chapterCount: number;
  fileList: string[];
  coverImage?: string;
}

export function readEpubInfo(epubPath: string): EpubInfo {
  const buffer = fs.readFileSync(epubPath);
  const entries = parseCentralDirectory(buffer);
  const fileList = entries.map((e) => e.name).sort();

  const metadata: Record<string, string> = {};
  let chapterCount = 0;
  let coverImage: string | undefined;

  const opfEntry = entries.find((e) => e.name.endsWith('content.opf'));
  if (opfEntry) {
    const opfContent = extractFileData(buffer, opfEntry, new Logger(true)).toString('utf-8');

    const dcRegex = /<dc:(\w+)(?:\s+[^>]*)?>([^<]*)<\/dc:\1>/g;
    let m: RegExpExecArray | null;
    while ((m = dcRegex.exec(opfContent)) !== null) {
      metadata[m[1]] = m[2];
    }

    const modifiedMatch = opfContent.match(/<meta\s+property="dcterms:modified">([^<]*)<\/meta>/);
    if (modifiedMatch) {
      metadata.modified = modifiedMatch[1];
    }

    const coverMetaMatch = opfContent.match(/<meta\s+name="cover"\s+content="([^"]+)"/);
    if (coverMetaMatch) {
      const coverId = coverMetaMatch[1];
      const coverItemRegex = new RegExp(`<item\\s+[^>]*id="${coverId}"[^>]*href="([^"]+)"`);
      const coverItemMatch = opfContent.match(coverItemRegex);
      if (coverItemMatch) {
        coverImage = coverItemMatch[1];
      }
    }
  }

  chapterCount = entries.filter(
    (e) => e.name.includes('OEBPS/text/') && e.name.endsWith('.xhtml') && !e.name.endsWith('cover.xhtml')
  ).length;

  return { metadata, chapterCount, fileList, coverImage };
}
