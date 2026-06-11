import { NavItem } from '../types';
import { escapeXml } from '../utils/text';

export interface NavContext {
  title: string;
  language: string;
  navItems: NavItem[];
}

function generateNavList(items: NavItem[]): string {
  if (items.length === 0) return '';
  const parts: string[] = [];
  parts.push('      <ol>');
  for (const item of items) {
    parts.push(`        <li>`);
    parts.push(`          <a href="${item.href}">${escapeXml(item.title)}</a>`);
    if (item.children.length > 0) {
      parts.push(generateNavList(item.children));
    }
    parts.push(`        </li>`);
  }
  parts.push('      </ol>');
  return parts.join('\n');
}

export function generateNav(ctx: NavContext): string {
  const navList = generateNavList(ctx.navItems);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(ctx.language)}">
  <head>
    <meta charset="UTF-8"/>
    <title>${escapeXml(ctx.title)}</title>
    <link rel="stylesheet" type="text/css" href="styles/main.css"/>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>${escapeXml(ctx.title)} - Table of Contents</h1>
${navList}
    </nav>
  </body>
</html>`;
}
