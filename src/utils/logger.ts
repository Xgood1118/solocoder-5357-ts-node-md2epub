export class Logger {
  private quietMode: boolean;
  private verboseMode: boolean;
  private debugMode: boolean;

  constructor(quiet = false, verbose = false, debug = false) {
    this.quietMode = quiet;
    this.verboseMode = verbose;
    this.debugMode = debug;
  }

  log(message: string): void {
    if (!this.quietMode) {
      console.log(message);
    }
  }

  info(message: string): void {
    if (!this.quietMode) {
      console.log(`[INFO] ${message}`);
    }
  }

  verbose(message: string): void {
    if (this.verboseMode && !this.quietMode) {
      console.log(`[VERBOSE] ${message}`);
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.debugMode && !this.quietMode) {
      console.log(`[DEBUG] ${message}`);
      if (data !== undefined) {
        console.dir(data, { depth: null, colors: true });
      }
    }
  }

  warn(message: string): void {
    console.warn(`[WARN] ${message}`);
  }

  error(message: string, error?: Error): void {
    console.error(`[ERROR] ${message}`);
    if (error && this.debugMode) {
      console.error(error.stack);
    }
  }

  progress(current: number, total: number, message: string): void {
    if (!this.quietMode) {
      const percent = Math.round((current / total) * 100);
      console.log(`[${current}/${total}] (${percent}%) ${message}`);
    }
  }
}
