import { EpubMetadata } from '../types';
import { escapeXml } from '../utils/text';

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export interface SpineItem {
  idref: string;
  linear?: 'yes' | 'no';
}

export interface OpfContext {
  metadata: EpubMetadata;
  manifest: ManifestItem[];
  spine: SpineItem[];
  coverImageId?: string;
  modified: string;
}

export function generateOpf(ctx: OpfContext): string {
  const m = ctx.metadata;
  const metaId = `meta-${m.identifier}`;

  const manifestXml = ctx.manifest
    .map((item) => {
      const props = item.properties ? ` properties="${item.properties}"` : '';
      return `    <item id="${item.id}" href="${item.href}" media-type="${item.mediaType}"${props}/>`;
    })
    .join('\n');

  const spineXml = ctx.spine
    .map((item) => {
      const linear = item.linear === 'no' ? ` linear="no"` : '';
      return `    <itemref idref="${item.idref}"${linear}/>`;
    })
    .join('\n');

  const coverMeta = ctx.coverImageId
    ? `    <meta name="cover" content="${ctx.coverImageId}"/>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="${metaId}" xml:lang="${escapeXml(m.language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="${metaId}">urn:uuid:${escapeXml(m.identifier)}</dc:identifier>
    <dc:title>${escapeXml(m.title)}</dc:title>
    <dc:creator>${escapeXml(m.creator)}</dc:creator>
    <dc:language>${escapeXml(m.language)}</dc:language>
    <dc:date>${escapeXml(m.date)}</dc:date>
    <dc:publisher>${escapeXml(m.publisher)}</dc:publisher>
    <dc:description>${escapeXml(m.description)}</dc:description>
    <dc:subject>${escapeXml(m.subject)}</dc:subject>
    <dc:rights>${escapeXml(m.rights)}</dc:rights>
    <meta property="dcterms:modified">${escapeXml(ctx.modified)}</meta>
${coverMeta}
  </metadata>
  <manifest>
${manifestXml}
  </manifest>
  <spine toc="ncx">
${spineXml}
  </spine>
</package>`;
}
