import { escapeXml } from '../utils/text';

export interface ChapterContext {
  title: string;
  language: string;
  contentXhtml: string;
  cssHref: string;
  chapterNumber: number;
}

export function generateChapterXhtml(ctx: ChapterContext): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(ctx.language)}">
  <head>
    <meta charset="UTF-8"/>
    <title>${escapeXml(ctx.title)}</title>
    <link rel="stylesheet" type="text/css" href="${ctx.cssHref}"/>
  </head>
  <body>
${ctx.contentXhtml}
  </body>
</html>`;
}

export interface CoverContext {
  title: string;
  author: string;
  language: string;
  cssHref: string;
  hasCoverImage: boolean;
  coverImageHref?: string;
}

export function generateCoverXhtml(ctx: CoverContext): string {
  if (ctx.hasCoverImage && ctx.coverImageHref) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(ctx.language)}">
  <head>
    <meta charset="UTF-8"/>
    <title>${escapeXml(ctx.title)}</title>
    <link rel="stylesheet" type="text/css" href="${ctx.cssHref}"/>
  </head>
  <body class="cover">
    <img src="${ctx.coverImageHref}" alt="Cover" />
  </body>
</html>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(ctx.language)}">
  <head>
    <meta charset="UTF-8"/>
    <title>${escapeXml(ctx.title)}</title>
    <link rel="stylesheet" type="text/css" href="${ctx.cssHref}"/>
  </head>
  <body class="cover">
    <div class="cover">
      <h1 class="cover-title">${escapeXml(ctx.title)}</h1>
      ${ctx.author ? `<p class="cover-author">${escapeXml(ctx.author)}</p>` : ''}
    </div>
  </body>
</html>`;
}
