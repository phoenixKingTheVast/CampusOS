export const FILE_SCANNER = Symbol('FILE_SCANNER');

export type ScanResult = { clean: boolean; reason?: string };

export type FileScanner = {
  scan(buffer: Buffer, mimeType: string): Promise<ScanResult>;
};

export const EICAR_TOKEN = 'EICAR-STANDARD-ANTIVIRUS-TEST-FILE';

export class DefaultFileScanner implements FileScanner {
  async scan(buffer: Buffer): Promise<ScanResult> {
    if (buffer.includes(Buffer.from(EICAR_TOKEN))) {
      return { clean: false, reason: 'This file did not pass the security check.' };
    }
    return { clean: true };
  }
}

export class RejectingFileScanner implements FileScanner {
  constructor(private readonly reason = 'This file did not pass the security check.') {}

  async scan(): Promise<ScanResult> {
    return { clean: false, reason: this.reason };
  }
}
