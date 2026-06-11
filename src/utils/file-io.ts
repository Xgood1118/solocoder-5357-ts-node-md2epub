import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const exists = promisify(fs.exists);

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    return await exists(filePath);
  } catch {
    return false;
  }
}

export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function isFile(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath);
    return s.isFile();
  } catch {
    return false;
  }
}

export async function getFileSize(filePath: string): Promise<number> {
  const s = await stat(filePath);
  return s.size;
}

export async function readTextFile(filePath: string): Promise<string> {
  const buf = await readFile(filePath);
  return buf.toString('utf-8');
}

export async function readBinaryFile(filePath: string): Promise<Buffer> {
  return await readFile(filePath);
}

export async function ensureDir(dirPath: string): Promise<void> {
  if (!(await fileExists(dirPath))) {
    await mkdir(dirPath, { recursive: true });
  }
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content, 'utf-8');
}

export async function writeBinaryFile(filePath: string, content: Buffer): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content);
}

export async function collectMarkdownFiles(input: string): Promise<string[]> {
  const files: string[] = [];

  if (await isFile(input)) {
    if (input.toLowerCase().endsWith('.md') || input.toLowerCase().endsWith('.markdown')) {
      files.push(path.resolve(input));
    }
    return files;
  }

  if (await isDirectory(input)) {
    const entries = await readdir(input);
    const mdFiles = entries
      .filter((f) => f.toLowerCase().endsWith('.md') || f.toLowerCase().endsWith('.markdown'))
      .map((f) => path.resolve(input, f))
      .sort((a, b) => a.localeCompare(b));
    files.push(...mdFiles);
  }

  return files;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function getExtension(filePath: string): string {
  return path.extname(filePath).toLowerCase().slice(1);
}

export function getBaseName(filePath: string): string {
  return path.basename(filePath, path.extname(filePath));
}
