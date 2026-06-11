import archiver from 'archiver';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';
import { ensureDir } from '../utils/file-io';
import { generateContainerXml } from './container';

export interface PackedFile {
  path: string;
  content: Buffer | string;
  isBinary: boolean;
}

export class EpubPacker {
  private logger: Logger;
  private files: PackedFile[] = [];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  addText(filePath: string, content: string): void {
    this.files.push({ path: filePath, content, isBinary: false });
    this.logger.verbose(`Adding text file: ${filePath}`);
  }

  addBinary(filePath: string, content: Buffer): void {
    this.files.push({ path: filePath, content, isBinary: true });
    this.logger.verbose(`Adding binary file: ${filePath} (${content.length} bytes)`);
  }

  async write(outputPath: string): Promise<number> {
    await ensureDir(path.dirname(outputPath));

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 },
        store: false,
      });

      output.on('close', () => {
        resolve(archive.pointer());
      });

      archive.on('error', (err: Error) => {
        reject(err);
      });

      archive.on('warning', (warn: archiver.ArchiverError) => {
        this.logger.warn(`EPUB pack warning: ${warn.message}`);
      });

      archive.pipe(output);

      const mimetype = 'application/epub+zip';
      archive.append(mimetype, {
        name: 'mimetype',
        store: true,
      });

      archive.append(generateContainerXml(), {
        name: 'META-INF/container.xml',
      });

      for (const file of this.files) {
        if (file.isBinary) {
          archive.append(file.content as Buffer, { name: file.path });
        } else {
          archive.append(file.content as string, { name: file.path });
        }
      }

      archive.finalize();
    });
  }
}
