import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  EpubOptions,
  EpubMetadata,
  Chapter,
  NavItem,
  EmbeddedImage,
  EmbeddedFont,
  GenerateStats,
  HeadingInfo,
} from './types';
import { Logger } from './utils/logger';
import {
  readTextFile,
  readBinaryFile,
  collectMarkdownFiles,
  fileExists,
  isDirectory,
  getFileSize,
  getBaseName,
  formatBytes,
  getExtension,
  ensureDir,
  writeTextFile,
  writeBinaryFile,
} from './utils/file-io';
import { shortHash } from './utils/hash';
import {
  downloadImage,
  loadLocalImage,
  isRemoteUrl,
  DownloadedImage,
} from './utils/image-downloader';
import { MarkdownParser, ParseResult } from './parser/markdown-parser';
import { generateContainerXml } from './epub/container';
import { generateMainCss } from './epub/css';
import { generateOpf, ManifestItem, SpineItem } from './epub/opf';
import { generateNcx } from './epub/ncx';
import { generateNav } from './epub/nav';
import { generateChapterXhtml, generateCoverXhtml } from './epub/chapter';
import { EpubPacker } from './epub/packer';
import { EpubValidator } from './epub/validator';
import { extractEpub } from './epub/extractor';
import { padNumber, nowIso8601, slugify } from './utils/text';

const MAX_IMAGE_WARN_BYTES = 5 * 1024 * 1024;

export class EpubGenerator {
  private options: EpubOptions;
  private logger: Logger;
  private parser: MarkdownParser;

  constructor(options: EpubOptions) {
    this.options = options;
    this.logger = new Logger(options.quiet, options.verbose, options.debug);
    this.parser = new MarkdownParser(this.logger);
  }

  async generate(): Promise<GenerateStats> {
    const startTime = Date.now();
    const allFiles: string[] = [];

    for (const input of this.options.inputs) {
      if (!(await fileExists(input))) {
        throw new Error(`Input path does not exist: ${input}`);
      }
      const mdFiles = await collectMarkdownFiles(input);
      if (mdFiles.length === 0) {
        this.logger.warn(`No markdown files found in: ${input}`);
      }
      allFiles.push(...mdFiles);
    }

    if (allFiles.length === 0) {
      throw new Error('No markdown files to process');
    }

    let totalSize = 0;
    for (const f of allFiles) {
      totalSize += await getFileSize(f);
    }

    this.logger.log(`Processing ${allFiles.length} file(s), total size: ${formatBytes(totalSize)}`);
    this.logger.debug('Input files:', allFiles);

    const chapters: Chapter[] = [];
    const imageMap = new Map<string, EmbeddedImage>();

    for (let i = 0; i < allFiles.length; i++) {
      const filePath = allFiles[i];
      this.logger.progress(i + 1, allFiles.length, `Parsing ${path.basename(filePath)}`);

      const chapter = await this.processMarkdownFile(filePath, i + 1, imageMap);
      chapters.push(chapter);
    }

    this.logger.debug('Parsed chapters:', chapters.map((c) => ({ id: c.id, title: c.title, headings: c.headings })));

    const navItems = this.buildNavTree(chapters);
    this.logger.debug('Navigation tree:', navItems);

    const metadata = this.buildMetadata(chapters);
    this.logger.debug('Metadata:', metadata);

    let embeddedFont: EmbeddedFont | undefined;
    if (this.options.embedFont) {
      embeddedFont = await this.loadFont();
    }

    let coverImage: EmbeddedImage | undefined;
    if (this.options.cover) {
      coverImage = await this.loadCoverImage();
    }

    const stats = await this.packEpub(
      chapters,
      navItems,
      metadata,
      imageMap,
      embeddedFont,
      coverImage
    );

    stats.durationMs = Date.now() - startTime;
    stats.totalInputSize = totalSize;
    stats.fileCount = allFiles.length;
    stats.chapterCount = chapters.length;
    stats.imageCount = imageMap.size;
    stats.fontCount = embeddedFont ? 1 : 0;

    if (this.options.validate) {
      await this.validateOutput(stats.outputPath);
    }

    this.printSummary(stats);
    return stats;
  }

  private async processMarkdownFile(
    filePath: string,
    index: number,
    imageMap: Map<string, EmbeddedImage>
  ): Promise<Chapter> {
    const baseDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const fallbackTitle = getBaseName(fileName);
    const content = await readTextFile(filePath);

    let parseResult: ParseResult;
    try {
      parseResult = this.parser.parse(content, fallbackTitle);
    } catch (err) {
      this.logger.error(`Failed to parse ${fileName}`, err as Error);
      throw err;
    }

    this.logger.verbose(`Parsed ${fileName}: ${parseResult.headings.length} headings, ${parseResult.images.length} images`);
    this.logger.debug(`AST headings for ${fileName}:`, parseResult.headings);

    const resolvedImages: Map<string, string> = new Map();
    for (const imgRef of parseResult.images) {
      const src = imgRef.originalSrc;
      if (resolvedImages.has(src)) continue;

      const embedded = await this.resolveAndEmbedImage(src, baseDir, imageMap);
      if (embedded) {
        const epubPath = `images/${embedded.hash}.${embedded.extension}`;
        resolvedImages.set(src, epubPath);
        this.logger.verbose(`Embedded image: ${src} -> ${epubPath}`);
      } else {
        const placeholder = `[Image: ${imgRef.alt || src} (unavailable)]`;
        resolvedImages.set(src, `__MISSING_IMAGE__${encodeURIComponent(placeholder)}`);
        this.logger.warn(`Image unavailable, using placeholder: ${src}`);
      }
    }

    let xhtml = parseResult.xhtml;
    for (const [originalSrc, newSrc] of resolvedImages) {
      if (newSrc.startsWith('__MISSING_IMAGE__')) {
        const placeholderText = decodeURIComponent(newSrc.slice('__MISSING_IMAGE__'.length));
        xhtml = xhtml.replace(
          new RegExp(`<img\\s+[^>]*src=["']${this.escapeRegex(originalSrc)}["'][^>]*/?>`, 'gi'),
          `<p class="image-placeholder" style="color:#888;font-style:italic;">${this.escapeHtml(placeholderText)}</p>`
        );
      } else {
        xhtml = xhtml.replace(
          new RegExp(`src=["']${this.escapeRegex(originalSrc)}["']`, 'gi'),
          `src="../${newSrc}"`
        );
      }
    }

    const hasH1 = parseResult.headings.some((h) => h.level === 1);
    let contentXhtml = xhtml;
    if (!hasH1) {
      contentXhtml = `<h1 id="chapter-title">${this.escapeHtml(parseResult.title)}</h1>\n${xhtml}`;
    }

    const chapterId = `chapter-${padNumber(index)}`;
    return {
      id: chapterId,
      title: parseResult.title,
      filePath,
      fileName,
      content,
      xhtml: contentXhtml,
      headings: parseResult.headings,
    };
  }

  private async resolveAndEmbedImage(
    src: string,
    baseDir: string,
    imageMap: Map<string, EmbeddedImage>
  ): Promise<EmbeddedImage | null> {
    let downloaded: DownloadedImage | null;

    if (isRemoteUrl(src)) {
      this.logger.verbose(`Downloading remote image: ${src}`);
      downloaded = await downloadImage(src, this.logger);
    } else {
      this.logger.verbose(`Loading local image: ${src} (base: ${baseDir})`);
      downloaded = await loadLocalImage(src, baseDir, this.logger);
    }

    if (!downloaded || !downloaded.data || downloaded.data.length === 0) {
      return null;
    }

    const hash = shortHash(downloaded.data);
    if (imageMap.has(hash)) {
      return imageMap.get(hash)!;
    }

    if (downloaded.data.length > MAX_IMAGE_WARN_BYTES) {
      this.logger.warn(
        `Image size exceeds 5MB (${formatBytes(downloaded.data.length)}): ${src}`
      );
    }

    const embedded: EmbeddedImage = {
      hash,
      data: downloaded.data,
      mimeType: downloaded.mimeType || 'image/png',
      extension: downloaded.extension || 'png',
      originalPath: src,
    };
    imageMap.set(hash, embedded);
    return embedded;
  }

  private buildNavTree(chapters: Chapter[]): NavItem[] {
    const root: NavItem[] = [];

    for (const chapter of chapters) {
      const chapterFileName = `${chapter.id}.xhtml`;
      let chapterH1: HeadingInfo | undefined;
      const otherHeadings: HeadingInfo[] = [];

      for (const h of chapter.headings) {
        if (!chapterH1 && h.level === 1) {
          chapterH1 = h;
        } else {
          otherHeadings.push(h);
        }
      }

      const chapterAnchor = chapterH1 ? chapterH1.anchor : 'chapter-title';
      const chapterTitle = chapterH1 ? chapterH1.text : chapter.title;

      const chapterNav: NavItem = {
        id: chapter.id,
        title: chapterTitle,
        href: `text/${chapterFileName}#${chapterAnchor}`,
        level: 1,
        children: [],
      };

      const stack: NavItem[] = [chapterNav];

      for (const h of otherHeadings) {
        if (h.level > 3) continue;

        const navItem: NavItem = {
          id: `${chapter.id}-${h.anchor}`,
          title: h.text,
          href: `text/${chapterFileName}#${h.anchor}`,
          level: h.level,
          children: [],
        };

        while (stack.length > 1 && stack[stack.length - 1].level >= h.level) {
          stack.pop();
        }

        if (stack.length === 0) {
          root.push(navItem);
        } else {
          stack[stack.length - 1].children.push(navItem);
        }
        stack.push(navItem);
      }

      root.push(chapterNav);
    }

    return root;
  }

  private buildMetadata(chapters: Chapter[]): EpubMetadata {
    let title = this.options.title;
    if (!title) {
      if (this.options.inputs.length === 1) {
        const firstInput = this.options.inputs[0];
        try {
          if (fs.existsSync(firstInput) && fs.statSync(firstInput).isDirectory()) {
            title = path.basename(path.resolve(firstInput));
          } else if (chapters.length > 0) {
            title = chapters[0].title;
          }
        } catch {
          if (chapters.length > 0) {
            title = chapters[0].title;
          }
        }
      } else if (chapters.length > 0) {
        title = chapters[0].title;
      }
    }
    if (!title) title = 'Untitled Book';

    let identifier = this.options.identifier;
    if (!identifier) {
      const allContent = chapters.map((c) => c.content).join('\n');
      identifier = shortHash(allContent, 32);
      if (identifier.length < 32) {
        identifier = identifier + uuidv4().replace(/-/g, '').slice(0, 32 - identifier.length);
      }
    }

    return {
      title,
      creator: this.options.author || 'Unknown Author',
      language: this.options.language || 'en',
      identifier,
      date: nowIso8601(),
      publisher: this.options.publisher || 'md2epub',
      description: this.options.description || `Generated by md2epub`,
      subject: this.options.subject || '',
      rights: this.options.rights || '',
    };
  }

  private async loadFont(): Promise<EmbeddedFont | undefined> {
    const fontPath = this.options.embedFont!;
    if (!(await fileExists(fontPath))) {
      this.logger.warn(`Font file not found: ${fontPath}`);
      return undefined;
    }

    const ext = getExtension(fontPath);
    let mimeType = '';
    if (ext === 'woff2') mimeType = 'font/woff2';
    else if (ext === 'woff') mimeType = 'font/woff';
    else if (ext === 'ttf') mimeType = 'font/ttf';
    else if (ext === 'otf') mimeType = 'font/otf';
    else {
      this.logger.warn(`Unsupported font format: .${ext}`);
      return undefined;
    }

    const data = await readBinaryFile(fontPath);
    const fileName = path.basename(fontPath);
    this.logger.verbose(`Embedded font: ${fileName} (${formatBytes(data.length)})`);
    return { fileName, data, mimeType };
  }

  private async loadCoverImage(): Promise<EmbeddedImage | undefined> {
    const coverPath = this.options.cover!;
    if (!(await fileExists(coverPath))) {
      this.logger.warn(`Cover image not found: ${coverPath}`);
      return undefined;
    }

    const data = await readBinaryFile(coverPath);
    const ext = getExtension(coverPath);
    return {
      hash: shortHash(data),
      data,
      mimeType: 'image/jpeg',
      extension: ext || 'jpg',
      originalPath: coverPath,
    };
  }

  private async packEpub(
    chapters: Chapter[],
    navItems: NavItem[],
    metadata: EpubMetadata,
    imageMap: Map<string, EmbeddedImage>,
    embeddedFont?: EmbeddedFont,
    coverImage?: EmbeddedImage
  ): Promise<GenerateStats> {
    const packer = new EpubPacker(this.logger);
    const manifest: ManifestItem[] = [];
    const spine: SpineItem[] = [];

    manifest.push({
      id: 'nav',
      href: 'nav.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: 'nav',
    });
    manifest.push({
      id: 'ncx',
      href: 'toc.ncx',
      mediaType: 'application/x-dtbncx+xml',
    });
    manifest.push({
      id: 'main-css',
      href: 'styles/main.css',
      mediaType: 'text/css',
    });

    let coverImageId: string | undefined;
    if (coverImage) {
      coverImageId = 'cover-image';
      manifest.push({
        id: coverImageId,
        href: `images/cover.${coverImage.extension}`,
        mediaType: coverImage.mimeType,
        properties: 'cover-image',
      });
      packer.addBinary(`OEBPS/images/cover.${coverImage.extension}`, coverImage.data);
    }

    manifest.push({
      id: 'cover',
      href: 'text/cover.xhtml',
      mediaType: 'application/xhtml+xml',
    });
    spine.push({ idref: 'cover', linear: 'no' });

    const coverXhtml = generateCoverXhtml({
      title: metadata.title,
      author: metadata.creator,
      language: metadata.language,
      cssHref: 'styles/main.css',
      hasCoverImage: !!coverImage,
      coverImageHref: coverImage ? `../images/cover.${coverImage.extension}` : undefined,
    });
    packer.addText('OEBPS/text/cover.xhtml', coverXhtml);

    for (const chapter of chapters) {
      const fileName = `${chapter.id}.xhtml`;
      manifest.push({
        id: chapter.id,
        href: `text/${fileName}`,
        mediaType: 'application/xhtml+xml',
      });
      spine.push({ idref: chapter.id });

      const chapterXhtml = generateChapterXhtml({
        title: chapter.title,
        language: metadata.language,
        contentXhtml: chapter.xhtml,
        cssHref: 'styles/main.css',
        chapterNumber: parseInt(chapter.id.split('-')[1]) || 1,
      });
      packer.addText(`OEBPS/text/${fileName}`, chapterXhtml);
    }

    let fontFileName: string | undefined;
    if (embeddedFont) {
      manifest.push({
        id: 'embedded-font',
        href: `fonts/${embeddedFont.fileName}`,
        mediaType: embeddedFont.mimeType,
      });
      packer.addBinary(`OEBPS/fonts/${embeddedFont.fileName}`, embeddedFont.data);
      fontFileName = embeddedFont.fileName;
    }

    for (const embedded of imageMap.values()) {
      manifest.push({
        id: `img-${embedded.hash.slice(0, 12)}`,
        href: `images/${embedded.hash}.${embedded.extension}`,
        mediaType: embedded.mimeType,
      });
      packer.addBinary(`OEBPS/images/${embedded.hash}.${embedded.extension}`, embedded.data);
    }

    const css = generateMainCss({
      embedFont: !!embeddedFont,
      fontFileName,
      language: metadata.language,
    });
    packer.addText('OEBPS/styles/main.css', css);

    const opfXml = generateOpf({
      metadata,
      manifest,
      spine,
      coverImageId,
      modified: nowIso8601(),
    });
    packer.addText('OEBPS/content.opf', opfXml);

    const ncxXml = generateNcx({
      title: metadata.title,
      identifier: metadata.identifier,
      navItems,
      chapterCount: chapters.length,
    });
    packer.addText('OEBPS/toc.ncx', ncxXml);

    const navXml = generateNav({
      title: metadata.title,
      language: metadata.language,
      navItems,
    });
    packer.addText('OEBPS/nav.xhtml', navXml);

    const outputSize = await packer.write(this.options.output);

    return {
      fileCount: 0,
      totalInputSize: 0,
      outputSize,
      outputPath: this.options.output,
      imageCount: imageMap.size,
      fontCount: embeddedFont ? 1 : 0,
      chapterCount: chapters.length,
      durationMs: 0,
    };
  }

  private async validateOutput(epubPath: string): Promise<void> {
    this.logger.info('Validating generated EPUB...');
    const tmpDir = path.join(path.dirname(epubPath), '.md2epub-validate-' + Date.now());
    try {
      await extractEpub(epubPath, tmpDir, new Logger(true));
      const validator = new EpubValidator(this.logger);
      const result = validator.validateExtracted(tmpDir);

      if (result.valid) {
        this.logger.log('EPUB validation: PASSED');
      } else {
        this.logger.warn('EPUB validation found errors:');
        for (const err of result.errors) {
          this.logger.warn(`  - ${err}`);
        }
      }
      for (const w of result.warnings) {
        this.logger.verbose(`  Warning: ${w}`);
      }
    } catch (err) {
      this.logger.warn(`Validation failed: ${(err as Error).message}`);
    } finally {
      this.cleanupDir(tmpDir).catch(() => {});
    }
  }

  private async cleanupDir(dirPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');
    if (!fs.existsSync(dirPath)) return;
    for (const entry of fs.readdirSync(dirPath)) {
      const fullPath = path.join(dirPath, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        await this.cleanupDir(fullPath);
      } else {
        fs.unlinkSync(fullPath);
      }
    }
    fs.rmdirSync(dirPath);
  }

  private printSummary(stats: GenerateStats): void {
    this.logger.log('');
    this.logger.log('=========================');
    this.logger.log('  EPUB Generation Done!');
    this.logger.log('=========================');
    this.logger.log(`Output file : ${stats.outputPath}`);
    this.logger.log(`Output size : ${formatBytes(stats.outputSize)}`);
    this.logger.log(`Chapters    : ${stats.chapterCount}`);
    this.logger.log(`Images      : ${stats.imageCount}`);
    this.logger.log(`Fonts       : ${stats.fontCount}`);
    this.logger.log(`Duration    : ${(stats.durationMs / 1000).toFixed(2)}s`);
    this.logger.log('=========================');
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
