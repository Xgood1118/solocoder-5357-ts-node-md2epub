import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../utils/logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const REQUIRED_FILES = [
  'mimetype',
  'META-INF/container.xml',
  'OEBPS/content.opf',
  'OEBPS/toc.ncx',
  'OEBPS/nav.xhtml',
];

const REQUIRED_METADATA = [
  'dc:title',
  'dc:creator',
  'dc:language',
  'dc:identifier',
  'dc:date',
];

export class EpubValidator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  validateExtracted(extractedDir: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.logger.info('Validating EPUB structure...');

    for (const file of REQUIRED_FILES) {
      const filePath = path.join(extractedDir, file);
      if (!fs.existsSync(filePath)) {
        errors.push(`Missing required file: ${file}`);
      }
    }

    const containerPath = path.join(extractedDir, 'META-INF', 'container.xml');
    if (fs.existsSync(containerPath)) {
      const containerXml = fs.readFileSync(containerPath, 'utf-8');
      if (!containerXml.includes('content.opf')) {
        errors.push('container.xml does not reference content.opf');
      }
    }

    const opfPath = path.join(extractedDir, 'OEBPS', 'content.opf');
    const referencedFiles = new Set<string>();

    if (fs.existsSync(opfPath)) {
      const opfXml = fs.readFileSync(opfPath, 'utf-8');

      for (const meta of REQUIRED_METADATA) {
        if (!opfXml.includes(meta)) {
          errors.push(`Missing required metadata: ${meta}`);
        }
      }

      const itemRegex = /<item\s+[^>]*href=["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = itemRegex.exec(opfXml)) !== null) {
        referencedFiles.add(m[1]);
      }

      const itemrefRegex = /<itemref\s+[^>]*idref=["']([^"']+)["']/gi;
      const spineIdrefs = new Set<string>();
      while ((m = itemrefRegex.exec(opfXml)) !== null) {
        spineIdrefs.add(m[1]);
      }

      const idRegex = /<item\s+[^>]*id=["']([^"']+)["']/gi;
      const manifestIds = new Set<string>();
      while ((m = idRegex.exec(opfXml)) !== null) {
        manifestIds.add(m[1]);
      }

      for (const idref of spineIdrefs) {
        if (!manifestIds.has(idref)) {
          errors.push(`Spine references non-existent manifest id: ${idref}`);
        }
      }
    }

    const navPath = path.join(extractedDir, 'OEBPS', 'nav.xhtml');
    if (fs.existsSync(navPath)) {
      const navXml = fs.readFileSync(navPath, 'utf-8');
      const linkRegex = /<a\s+[^>]*href=["']([^"']+)["']/gi;
      let m: RegExpExecArray | null;
      while ((m = linkRegex.exec(navXml)) !== null) {
        const href = m[1].split('#')[0];
        if (href && !href.startsWith('http')) {
          const fullPath = path.join('OEBPS', href);
          if (!fs.existsSync(path.join(extractedDir, fullPath))) {
            warnings.push(`NAV references missing file: ${href}`);
          }
        }
      }
    }

    const textDir = path.join(extractedDir, 'OEBPS', 'text');
    if (fs.existsSync(textDir)) {
      const chapterFiles = fs.readdirSync(textDir).filter((f) => f.endsWith('.xhtml'));
      this.logger.verbose(`Found ${chapterFiles.length} chapter files`);

      for (const file of chapterFiles) {
        const relPath = `text/${file}`;
        if (!referencedFiles.has(relPath)) {
          warnings.push(`Chapter file not referenced in OPF manifest: ${relPath}`);
        }
      }
    }

    const valid = errors.length === 0;
    return { valid, errors, warnings };
  }
}
