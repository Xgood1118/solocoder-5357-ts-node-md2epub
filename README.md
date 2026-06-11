# md2epub

将 Markdown 文件或目录转换为 EPUB 3 格式电子书的命令行工具，专为技术笔记和 Kindle 阅读优化。

## 特性

- **Markdown 完整语法支持**：标题（H1-H6）、段落、列表（有序/无序/嵌套）、代码块、行内代码、引用、加粗、斜体、删除线、链接、图片、GFM 表格、水平分割线
- **EPUB 3 标准输出**：包含 OPF、NCX、NAV 文件，兼容新旧阅读器
- **多级目录导航**：H1-H3 自动生成多级导航目录
- **图片处理**：本地图片内嵌、远程图片自动下载、相同图片去重、下载失败占位提示
- **中文字体嵌入**：支持 woff2/ttf/otf 字体嵌入，避免中文变成方块
- **CSS 样式优化**：中文段落首行缩进、代码块高亮样式、引用块竖线、链接样式
- **封面支持**：自定义封面图或自动生成纯色封面
- **内容校验**：内置 EPUB 基础校验
- **调试模式**：打印 AST、导航树等中间数据
- **子命令**：查看 EPUB 元信息、解压 EPUB 调试

## 安装依赖

```bash
npm install
```

## 编译

```bash
npm run build
```

## 使用

### 基本使用

**转换单个 Markdown 文件：**

```bash
npx ts-node src/cli.ts --input ./notes/chapter1.md --output ./out/book.epub
```

**转换整个目录（按文件名字典序排序合并为一本书）：**

```bash
npx ts-node src/cli.ts --input ./notes --output ./out/book.epub
```

**合并多个 Markdown 文件（按参数顺序）：**

```bash
npx ts-node src/cli.ts --input ch1.md --input ch2.md --input ch3.md --output ./out/combined.epub
```

### 指定元数据

```bash
npx ts-node src/cli.ts \
  --input ./notes \
  --output ./out/mybook.epub \
  --title "我的技术笔记" \
  --author "张三" \
  --language zh \
  --publisher "个人出版" \
  --description "收集整理的技术学习笔记"
```

### 嵌入中文字体

```bash
npx ts-node src/cli.ts \
  --input ./notes \
  --output ./out/book.epub \
  --embed-font ./fonts/SourceHanSansCN-Regular.otf
```

### 指定封面图

```bash
npx ts-node src/cli.ts \
  --input ./notes \
  --output ./out/book.epub \
  --cover ./cover.jpg
```

### 生成后校验

```bash
npx ts-node src/cli.ts \
  --input ./notes \
  --output ./out/book.epub \
  --validate
```

### 调试 / 详细输出

```bash
# 调试模式，打印 AST 和导航树
npx ts-node src/cli.ts --input ./notes --output ./out/book.epub --debug

# 详细输出每个步骤
npx ts-node src/cli.ts --input ./notes --output ./out/book.epub --verbose

# 安静模式，只输出错误
npx ts-node src/cli.ts --input ./notes --output ./out/book.epub --quiet
```

### 子命令

**查看 EPUB 信息：**

```bash
npx ts-node src/cli.ts info ./out/book.epub

# 显示详细文件列表
npx ts-node src/cli.ts info ./out/book.epub --verbose
```

**解压 EPUB：**

```bash
npx ts-node src/cli.ts extract ./out/book.epub --output ./extracted
```

### 编译后使用

```bash
npm run build
node dist/cli.js --input ./notes --output ./out/book.epub
```

## 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-i, --input <path...>` | 输入 md 文件或目录（可多个） | 必填 |
| `-o, --output <path>` | 输出 EPUB 文件路径 | `./output.epub` |
| `-t, --title <title>` | 书名 | 自动从目录名或 H1 推断 |
| `-a, --author <author>` | 作者 | `Unknown Author` |
| `-l, --language <lang>` | 语言代码 | `en` |
| `--identifier <id>` | 唯一标识符 (UUID) | 基于内容 hash 生成 |
| `--publisher <name>` | 出版社 | `md2epub` |
| `--description <text>` | 描述 | |
| `--subject <text>` | 主题 | |
| `--rights <text>` | 版权信息 | |
| `--embed-font <path>` | 嵌入字体文件 (woff2/ttf/otf) | |
| `--cover <path>` | 封面图片路径 (JPEG 推荐) | |
| `--validate` | 生成后校验 EPUB | `false` |
| `--debug` | 调试模式，打印中间数据 | `false` |
| `-q, --quiet` | 安静模式，只输出错误 | `false` |
| `-v, --verbose` | 详细输出 | `false` |

## EPUB 内部结构

```
.
├── mimetype
├── META-INF/
│   └── container.xml
└── OEBPS/
    ├── content.opf
    ├── toc.ncx
    ├── nav.xhtml
    ├── styles/
    │   └── main.css
    ├── fonts/            (嵌入字体时存在)
    ├── images/
    │   └── <hash>.<ext>
    └── text/
        ├── cover.xhtml
        ├── chapter-001.xhtml
        ├── chapter-002.xhtml
        └── ...
```

## 依赖（5 个运行时依赖）

- `commander` - 命令行参数解析
- `markdown-it` - Markdown 解析
- `archiver` - ZIP/EPUB 打包
- `mime-types` - MIME 类型推断
- `uuid` - UUID 生成

## 测试示例

`test/` 目录下有几个示例 Markdown 文件可以用来测试：

```bash
npx ts-node src/cli.ts --input ./test --output ./out/test.epub --title "测试书籍" --validate
```
