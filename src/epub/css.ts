export interface CssOptions {
  embedFont: boolean;
  fontFileName?: string;
  language?: string;
}

export function generateMainCss(options: CssOptions): string {
  const fontFaceBlock = options.embedFont && options.fontFileName
    ? `@font-face {
  font-family: "EmbeddedChinese";
  src: url("../fonts/${options.fontFileName}");
  font-weight: normal;
  font-style: normal;
}
`
    : '';

  const fontFamilyFallback = options.embedFont
    ? `"EmbeddedChinese", "PingFang SC", "Microsoft YaHei", "SimSun", "Noto Sans CJK SC", serif`
    : `"PingFang SC", "Microsoft YaHei", "SimSun", "Noto Sans CJK SC", "Hiragino Sans GB", "WenQuanYi Micro Hei", serif`;

  return `${fontFaceBlock}@charset "UTF-8";

html, body {
  margin: 0;
  padding: 0;
  line-height: 1.7;
  font-family: ${fontFamilyFallback};
  font-size: 1em;
  color: #1a1a1a;
}

body {
  padding: 1em 1.2em;
}

/* Chinese paragraphs: first line indent */
p:lang(zh),
p[lang|="zh"],
p.chinese {
  text-indent: 2em;
  margin: 0.8em 0;
}

/* English paragraphs: no indent, spacing between */
p:lang(en),
p[lang|="en"] {
  text-indent: 0;
  margin: 1em 0;
}

p {
  margin: 0.8em 0;
  text-align: justify;
}

/* Headings */
h1, h2, h3, h4, h5, h6 {
  font-weight: bold;
  line-height: 1.3;
  margin: 1.5em 0 0.8em;
  page-break-after: avoid;
  page-break-inside: avoid;
}

h1 {
  font-size: 1.8em;
  border-bottom: 2px solid #ddd;
  padding-bottom: 0.3em;
  margin-top: 1em;
}

h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.2em;
}

h3 { font-size: 1.3em; }
h4 { font-size: 1.15em; }
h5 { font-size: 1.05em; }
h6 { font-size: 1em; color: #555; }

/* Lists */
ul, ol {
  margin: 0.8em 0;
  padding-left: 2em;
}

li {
  margin: 0.3em 0;
}

li > ul, li > ol {
  margin: 0.3em 0;
}

/* Code blocks and inline code */
pre {
  background-color: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1em;
  overflow-x: auto;
  font-family: "Consolas", "Monaco", "Courier New", "Source Code Pro", monospace;
  font-size: 0.88em;
  line-height: 1.5;
  white-space: pre-wrap;
  word-wrap: break-word;
  page-break-inside: avoid;
  margin: 1em 0;
}

code {
  font-family: "Consolas", "Monaco", "Courier New", "Source Code Pro", monospace;
  background-color: #f0f0f0;
  padding: 0.15em 0.4em;
  border-radius: 3px;
  font-size: 0.9em;
}

pre code {
  background-color: transparent;
  padding: 0;
  font-size: 1em;
}

/* Blockquotes */
blockquote {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 4px solid #ccc;
  background-color: #fafafa;
  color: #555;
  font-style: italic;
  page-break-inside: avoid;
}

blockquote p {
  margin: 0.4em 0;
  text-indent: 0;
}

/* Links */
a {
  color: #1a5fb4;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* Images */
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
  page-break-inside: avoid;
}

/* Tables */
table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
  page-break-inside: avoid;
  font-size: 0.95em;
}

table th, table td {
  border: 1px solid #ddd;
  padding: 0.5em 0.8em;
  text-align: left;
}

table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

table tr:nth-child(even) {
  background-color: #fafafa;
}

/* Horizontal rule */
hr {
  border: none;
  border-top: 1px solid #ddd;
  margin: 2em auto;
  width: 60%;
}

/* Emphasis */
strong { font-weight: bold; }
em { font-style: italic; }
del, s, strike { text-decoration: line-through; }

/* Cover */
.cover {
  text-align: center;
  padding: 3em 1em;
}

.cover-title {
  font-size: 2.5em;
  font-weight: bold;
  margin: 1em 0;
}

.cover-author {
  font-size: 1.2em;
  color: #555;
}
`;
}
