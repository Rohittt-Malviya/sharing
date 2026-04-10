import { describe, it, expect } from 'vitest';
import { validateFile, MAX_FILE_SIZE, MAX_FILE_SIZE_LABEL } from '../utils/fileValidation';

/**
 * Build a minimal File object for testing.
 * Using an ArrayBuffer of the exact requested size avoids allocating real content.
 */
function makeFile(name, size, type = '') {
  const buf = new ArrayBuffer(size);
  return new File([buf], name, { type });
}

// ─── null / undefined ─────────────────────────────────────────────────────────

describe('validateFile – missing input', () => {
  it('returns invalid for null', () => {
    const result = validateFile(null);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/no file/i);
  });

  it('returns invalid for undefined', () => {
    const result = validateFile(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/no file/i);
  });
});

// ─── empty files ──────────────────────────────────────────────────────────────

describe('validateFile – empty files', () => {
  it('rejects a 0-byte file', () => {
    const result = validateFile(makeFile('empty.txt', 0));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/empty/i);
  });

  it('accepts a 1-byte file', () => {
    expect(validateFile(makeFile('tiny.txt', 1)).valid).toBe(true);
  });
});

// ─── file size limit ──────────────────────────────────────────────────────────

describe('validateFile – size limit', () => {
  it('accepts a file exactly at the limit', () => {
    expect(validateFile(makeFile('exact.bin', MAX_FILE_SIZE)).valid).toBe(true);
  });

  it('rejects a file one byte over the limit', () => {
    const result = validateFile(makeFile('toobig.bin', MAX_FILE_SIZE + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it('includes the human-readable size limit in the error message', () => {
    const result = validateFile(makeFile('toobig.bin', MAX_FILE_SIZE + 1));
    expect(result.error).toContain(MAX_FILE_SIZE_LABEL);
  });

  it('includes the file\'s own size in the error message', () => {
    const result = validateFile(makeFile('big.bin', MAX_FILE_SIZE + 1024));
    // formatBytes output pattern, e.g. "2.0 GB"
    expect(result.error).toMatch(/\d+(\.\d+)?\s?(B|KB|MB|GB)/);
  });
});

// ─── blocked file types ───────────────────────────────────────────────────────

describe('validateFile – blocked extensions', () => {
  const BLOCKED = [
    'virus.exe',
    'run.bat',
    'script.cmd',
    'app.com',
    'installer.msi',
    'screensaver.scr',
    'link.pif',
    'macro.vbs',
    'macro.vbe',
    'script.wsf',
    'web.hta',
    'powershell.ps1',
    'control.cpl',
  ];

  BLOCKED.forEach((name) => {
    it(`rejects ${name}`, () => {
      const result = validateFile(makeFile(name, 1024));
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/security/i);
    });
  });

  it('is case-insensitive (rejects .EXE)', () => {
    expect(validateFile(makeFile('VIRUS.EXE', 1024)).valid).toBe(false);
  });

  it('is case-insensitive (rejects .PS1)', () => {
    expect(validateFile(makeFile('Script.PS1', 1024)).valid).toBe(false);
  });
});

// ─── allowed file types ───────────────────────────────────────────────────────

describe('validateFile – allowed extensions', () => {
  const ALLOWED = [
    'document.pdf',
    'photo.jpg',
    'photo.jpeg',
    'image.png',
    'image.gif',
    'image.webp',
    'video.mp4',
    'video.mov',
    'audio.mp3',
    'audio.wav',
    'archive.zip',
    'archive.tar',
    'archive.gz',
    'spreadsheet.xlsx',
    'presentation.pptx',
    'document.docx',
    'ebook.epub',
    'code.js',
    'code.ts',
    'code.py',
    'styles.css',
    'data.json',
    'data.xml',
    'data.csv',
    'deploy.sh',
    'deploy.bash',
    'Makefile',
  ];

  ALLOWED.forEach((name) => {
    it(`accepts ${name}`, () => {
      expect(validateFile(makeFile(name, 1024)).valid).toBe(true);
    });
  });

  it('accepts a file with no extension', () => {
    expect(validateFile(makeFile('Dockerfile', 512)).valid).toBe(true);
  });
});
