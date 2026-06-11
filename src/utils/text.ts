export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function padNumber(num: number, width = 3): string {
  return num.toString().padStart(width, '0');
}

export function detectLanguage(text: string): 'zh' | 'en' {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalChars = text.replace(/\s/g, '').length;
  if (totalChars === 0) return 'en';
  return chineseChars / totalChars > 0.3 ? 'zh' : 'en';
}

export function nowIso8601(): string {
  return new Date().toISOString();
}
