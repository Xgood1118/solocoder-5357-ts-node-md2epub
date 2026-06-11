import { Command } from 'commander';
import * as path from 'path';
import { EpubGenerator } from './generator';
import { EpubOptions } from './types';
import { Logger } from './utils/logger';
import { readEpubInfo, extractEpub } from './epub/extractor';
import { fileExists } from './utils/file-io';

async function runGenerate(options: EpubOptions): Promise<void> {
  const logger = new Logger(options.quiet, options.verbose, options.debug);
  try {
    const generator = new EpubGenerator(options);
    await generator.generate();
  } catch (err) {
    logger.error('EPUB generation failed', err as Error);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('md2epub')
    .description('Convert Markdown files or directories to EPUB 3 format')
    .version('1.0.0');

  program
    .option('-i, --input <path...>', 'Input markdown file(s) or directory')
    .option('-o, --output <path>', 'Output EPUB file path', './output.epub')
    .option('-t, --title <title>', 'Book title')
    .option('-a, --author <author>', 'Book author', 'Unknown Author')
    .option('-l, --language <lang>', 'Book language code', 'en')
    .option('--identifier <id>', 'Unique identifier (UUID)')
    .option('--publisher <name>', 'Publisher name', 'md2epub')
    .option('--description <text>', 'Book description')
    .option('--subject <text>', 'Book subject')
    .option('--rights <text>', 'Copyright information')
    .option('--embed-font <path>', 'Embed a font file (woff2/ttf/otf)')
    .option('--cover <path>', 'Cover image path (JPEG recommended)')
    .option('--validate', 'Validate EPUB after generation', false)
    .option('--debug', 'Enable debug output with intermediate data', false)
    .option('-q, --quiet', 'Suppress all output except errors', false)
    .option('-v, --verbose', 'Enable verbose output', false)
    .action(async (cmdOpts) => {
      const opts = cmdOpts as EpubOptions & { input?: string[] };

      if (!opts.input || opts.input.length === 0) {
        console.error('[ERROR] At least one --input is required. Use -h for help.');
        process.exit(1);
      }

      const genOpts: EpubOptions = {
        inputs: opts.input.map((p) => path.resolve(p)),
        output: path.resolve(opts.output),
        title: opts.title,
        author: opts.author,
        language: opts.language,
        identifier: opts.identifier,
        publisher: opts.publisher,
        description: opts.description,
        subject: opts.subject,
        rights: opts.rights,
        embedFont: opts.embedFont ? path.resolve(opts.embedFont) : undefined,
        cover: opts.cover ? path.resolve(opts.cover) : undefined,
        validate: opts.validate,
        debug: opts.debug,
        quiet: opts.quiet,
        verbose: opts.verbose,
      };

      await runGenerate(genOpts);
    });

  program
    .command('info')
    .description('Show metadata and structure info of an existing EPUB file')
    .argument('<epub>', 'Path to EPUB file')
    .option('-v, --verbose', 'Show detailed file listing', false)
    .action(async (epubPath: string, opts: { verbose: boolean }) => {
      const logger = new Logger(false, opts.verbose, false);
      try {
        if (!(await fileExists(epubPath))) {
          console.error(`[ERROR] EPUB file not found: ${epubPath}`);
          process.exit(1);
        }
        const info = readEpubInfo(epubPath);
        console.log('');
        console.log('=========================');
        console.log('  EPUB Information');
        console.log('=========================');
        console.log(`Title       : ${info.metadata.title || 'N/A'}`);
        console.log(`Author      : ${info.metadata.creator || 'N/A'}`);
        console.log(`Language    : ${info.metadata.language || 'N/A'}`);
        console.log(`Identifier  : ${info.metadata.identifier || 'N/A'}`);
        console.log(`Date        : ${info.metadata.date || info.metadata.modified || 'N/A'}`);
        console.log(`Publisher   : ${info.metadata.publisher || 'N/A'}`);
        if (info.metadata.description) console.log(`Description : ${info.metadata.description}`);
        if (info.metadata.subject) console.log(`Subject     : ${info.metadata.subject}`);
        if (info.metadata.rights) console.log(`Rights      : ${info.metadata.rights}`);
        console.log(`Chapters    : ${info.chapterCount}`);
        console.log(`Cover image : ${info.coverImage || 'None'}`);
        console.log(`Total files : ${info.fileList.length}`);
        console.log('=========================');

        if (opts.verbose) {
          console.log('');
          console.log('File listing:');
          for (const f of info.fileList) {
            console.log(`  ${f}`);
          }
        }
      } catch (err) {
        logger.error('Failed to read EPUB info', err as Error);
        process.exit(1);
      }
    });

  program
    .command('extract')
    .description('Extract an EPUB file to a directory for inspection')
    .argument('<epub>', 'Path to EPUB file')
    .option('-o, --output <path>', 'Output directory', './extracted')
    .option('-q, --quiet', 'Suppress output', false)
    .option('-v, --verbose', 'Show extracted files', false)
    .action(async (epubPath: string, opts: { output: string; quiet: boolean; verbose: boolean }) => {
      const logger = new Logger(opts.quiet, opts.verbose, false);
      try {
        if (!(await fileExists(epubPath))) {
          console.error(`[ERROR] EPUB file not found: ${epubPath}`);
          process.exit(1);
        }
        const absOutput = path.resolve(opts.output);
        await extractEpub(epubPath, absOutput, logger);
        if (!opts.quiet) {
          console.log(`EPUB extracted to: ${absOutput}`);
        }
      } catch (err) {
        logger.error('Failed to extract EPUB', err as Error);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
