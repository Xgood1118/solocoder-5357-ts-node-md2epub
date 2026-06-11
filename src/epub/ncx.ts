import { NavItem } from '../types';
import { escapeXml } from '../utils/text';

export interface NcxContext {
  title: string;
  identifier: string;
  navItems: NavItem[];
  chapterCount: number;
}

function generateNavPoints(items: NavItem[], startPlayOrder: number): { xml: string; playOrder: number } {
  let playOrder = startPlayOrder;
  const parts: string[] = [];

  for (const item of items) {
    const currentPlayOrder = playOrder++;
    const indent = '    '.repeat(item.level);
    parts.push(`${indent}<navPoint id="navpoint-${currentPlayOrder}" playOrder="${currentPlayOrder}">`);
    parts.push(`${indent}  <navLabel><text>${escapeXml(item.title)}</text></navLabel>`);
    parts.push(`${indent}  <content src="${item.href}"/>`);
    if (item.children.length > 0) {
      const childResult = generateNavPoints(item.children, playOrder);
      parts.push(childResult.xml);
      playOrder = childResult.playOrder;
    }
    parts.push(`${indent}</navPoint>`);
  }

  return { xml: parts.join('\n'), playOrder };
}

export function generateNcx(ctx: NcxContext): string {
  const navPointsResult = generateNavPoints(ctx.navItems, 1);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ncx PUBLIC "-//NISO//DTD ncx 2005-1//EN"
  "http://www.daisy.org/z3986/2005/ncx-2005-1.dtd">
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="urn:uuid:${escapeXml(ctx.identifier)}"/>
    <meta name="dtb:depth" content="3"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle>
    <text>${escapeXml(ctx.title)}</text>
  </docTitle>
  <navMap>
${navPointsResult.xml}
  </navMap>
</ncx>`;
}
