export interface NavItem {
  id: string;
  title: string;
  href: string;
  level: number;
  children: NavItem[];
}

export interface Chapter {
  id: string;
  title: string;
  filePath: string;
  fileName: string;
  content: string;
  xhtml: string;
  headings: HeadingInfo[];
  language: string;
}

export interface HeadingInfo {
  level: number;
  text: string;
  anchor: string;
}

export interface EmbeddedImage {
  hash: string;
  data: Buffer;
  mimeType: string;
  extension: string;
  originalPath: string;
}

export interface EmbeddedFont {
  fileName: string;
  data: Buffer;
  mimeType: string;
}

export interface EpubOptions {
  inputs: string[];
  output: string;
  title?: string;
  author?: string;
  language: string;
  identifier?: string;
  publisher?: string;
  description?: string;
  subject?: string;
  rights?: string;
  embedFont?: string;
  cover?: string;
  validate: boolean;
  debug: boolean;
  quiet: boolean;
  verbose: boolean;
}

export interface EpubMetadata {
  title: string;
  creator: string;
  language: string;
  identifier: string;
  date: string;
  publisher: string;
  description: string;
  subject: string;
  rights: string;
}

export interface GenerateStats {
  fileCount: number;
  totalInputSize: number;
  outputSize: number;
  outputPath: string;
  imageCount: number;
  fontCount: number;
  chapterCount: number;
  durationMs: number;
}
