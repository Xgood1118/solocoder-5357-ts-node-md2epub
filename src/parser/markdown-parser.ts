import MarkdownIt from 'markdown-it';
import { HeadingInfo } from '../types';
import { slugify, stripHtmlTags, detectLanguage } from '../utils/text';
import { Logger } from '../utils/logger';

export interface ParseResult {
  xhtml: string;
  headings: HeadingInfo[];
  images: ImageRef[];
  title: string;
  language: 'zh' | 'en';
}

export interface ImageRef {
  originalSrc: string;
  alt: string;
  position: number;
}

const headingAnchorCounter: Record<string, number> = {};

function makeUniqueAnchor(text: string): string {
  const base = slugify(text) || 'heading';
  if (!headingAnchorCounter[base]) {
    headingAnchorCounter[base] = 1;
    return base;
  }
  headingAnchorCounter[base]++;
  return `${base}-${headingAnchorCounter[base]}`;
}

export class MarkdownParser {
  private md: MarkdownIt;
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
    this.md = new MarkdownIt({
      html: false,
      linkify: true,
      typographer: true,
      breaks: false,
    });
    this.md.enable('table');
    this.md.enable('strikethrough');
  }

  parse(markdown: string, fallbackTitle: string): ParseResult {
    for (const key of Object.keys(headingAnchorCounter)) {
      delete headingAnchorCounter[key];
    }

    const lines = markdown.split('\n');
    const headings: HeadingInfo[] = [];
    const images: ImageRef[] = [];

    const headingRegex = /^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/;
    let firstLineTitle = fallbackTitle;
    let hasH1 = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(headingRegex);
      if (match) {
        const level = match[1].length;
        const text = stripHtmlTags(match[2]).trim();
        if (!text) continue;

        if (level === 1 && !hasH1) {
          hasH1 = true;
          firstLineTitle = text;
        }

        if (i === 0 && !hasH1) {
          firstLineTitle = text;
        }

        const anchor = makeUniqueAnchor(text);
        headings.push({ level, text, anchor });
      } else if (i === 0 && !hasH1 && line.trim()) {
        const cleaned = line.replace(/^#+\s*/, '').trim();
        if (cleaned) {
          firstLineTitle = cleaned;
        }
      }
    }

    let html: string;
    try {
      html = this.md.render(markdown);
    } catch (err) {
      this.logger.error(`Markdown parsing error`, err as Error);
      throw new Error(`Failed to parse markdown: ${(err as Error).message}`);
    }

    const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi;
    let imgMatch: RegExpExecArray | null;
    while ((imgMatch = imgRegex.exec(html)) !== null) {
      images.push({
        originalSrc: imgMatch[1],
        alt: imgMatch[2],
        position: imgMatch.index,
      });
    }

    const processedHtml = this.processHeadings(html, headings);
    const xhtml = this.htmlToXhtml(processedHtml);

    const language = detectLanguage(markdown);

    return {
      xhtml,
      headings,
      images,
      title: firstLineTitle || fallbackTitle,
      language,
    };
  }

  private processHeadings(html: string, headings: HeadingInfo[]): string {
    let idx = 0;
    return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/gi, (match, levelStr, inner) => {
      const level = parseInt(levelStr, 10);
      const text = stripHtmlTags(inner).trim();
      const heading = headings[idx];
      let anchor: string;
      if (heading && heading.level === level && heading.text === text) {
        anchor = heading.anchor;
        idx++;
      } else {
        anchor = makeUniqueAnchor(text);
      }
      return `<h${level} id="${anchor}">${inner}</h${level}>`;
    });
  }

  private htmlToXhtml(html: string): string {
    let result = html;
    result = result.replace(/<br\s*\/?>/gi, '<br />');
    result = result.replace(/<hr\s*\/?>/gi, '<hr />');
    result = result.replace(/<img([^>]*?)(?<!\/)\s*>/gi, (match, attrs) => {
      return `<img${attrs.trim()} />`;
    });
    return result;
  }
}
