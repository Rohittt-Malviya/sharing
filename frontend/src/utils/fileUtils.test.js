import { describe, it, expect } from 'vitest';
import {
  CHUNK_SIZE,
  fileToChunks,
  chunksToBlob,
  formatBytes,
  formatEta,
  formatSpeed,
} from '../utils/fileUtils';

// ─── formatBytes ──────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('returns "0 B" for 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes (< 1 KB)', () => {
    expect(formatBytes(512)).toBe('512.0 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
  });
});

// ─── formatEta ────────────────────────────────────────────────────────────────

describe('formatEta', () => {
  it('returns "--:--" for Infinity', () => {
    expect(formatEta(Infinity)).toBe('--:--');
  });

  it('returns "--:--" for negative values', () => {
    expect(formatEta(-1)).toBe('--:--');
  });

  it('returns "--:--" for NaN', () => {
    expect(formatEta(NaN)).toBe('--:--');
  });

  it('formats 0 seconds as "0:00"', () => {
    expect(formatEta(0)).toBe('0:00');
  });

  it('formats seconds only (< 60 s)', () => {
    expect(formatEta(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatEta(90)).toBe('1:30');
    expect(formatEta(125)).toBe('2:05');
  });

  it('truncates fractional seconds', () => {
    expect(formatEta(59.9)).toBe('0:59');
  });
});

// ─── formatSpeed ──────────────────────────────────────────────────────────────

describe('formatSpeed', () => {
  it('appends "/s" to the formatted bytes', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
    expect(formatSpeed(1024)).toBe('1.0 KB/s');
    expect(formatSpeed(1024 * 1024)).toBe('1.0 MB/s');
  });
});

// ─── fileToChunks ─────────────────────────────────────────────────────────────

describe('fileToChunks', () => {
  it('returns an empty array for an empty file', async () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' });
    const chunks = await fileToChunks(file);
    expect(chunks).toEqual([]);
  });

  it('returns a single chunk for a file smaller than CHUNK_SIZE', async () => {
    const data = new Uint8Array(100).fill(0xab);
    const file = new File([data], 'small.bin');
    const chunks = await fileToChunks(file);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].byteLength).toBe(100);
    // Verify content is preserved
    expect(new Uint8Array(chunks[0])[0]).toBe(0xab);
  });

  it('returns exactly 2 chunks for a file that is exactly 1.5 × CHUNK_SIZE', async () => {
    const size = Math.floor(CHUNK_SIZE * 1.5);
    const file = new File([new Uint8Array(size)], 'medium.bin');
    const chunks = await fileToChunks(file);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].byteLength).toBe(CHUNK_SIZE);
    expect(chunks[1].byteLength).toBe(size - CHUNK_SIZE);
  });

  it('total bytes across all chunks equals file size', async () => {
    const size = CHUNK_SIZE * 3 + 7777;
    const file = new File([new Uint8Array(size)], 'large.bin');
    const chunks = await fileToChunks(file);
    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    expect(total).toBe(size);
  });

  it('produces 1 chunk per CHUNK_SIZE boundary (exact multiple)', async () => {
    const file = new File([new Uint8Array(CHUNK_SIZE * 4)], 'exact.bin');
    const chunks = await fileToChunks(file);
    expect(chunks).toHaveLength(4);
    chunks.forEach((c) => expect(c.byteLength).toBe(CHUNK_SIZE));
  });
});

// ─── chunksToBlob ─────────────────────────────────────────────────────────────

describe('chunksToBlob', () => {
  it('reassembles a single chunk into a Blob with correct size', () => {
    const buf = new Uint8Array([1, 2, 3]).buffer;
    const blob = chunksToBlob([buf]);
    expect(blob.size).toBe(3);
  });

  it('uses "application/octet-stream" as default MIME type', () => {
    const blob = chunksToBlob([new ArrayBuffer(4)]);
    expect(blob.type).toBe('application/octet-stream');
  });

  it('honours a custom MIME type', () => {
    const blob = chunksToBlob([new ArrayBuffer(4)], 'image/png');
    expect(blob.type).toBe('image/png');
  });

  it('total size equals sum of chunk sizes', () => {
    const chunks = [
      new Uint8Array(100).buffer,
      new Uint8Array(200).buffer,
      new Uint8Array(50).buffer,
    ];
    expect(chunksToBlob(chunks).size).toBe(350);
  });

  it('round-trips data through fileToChunks → chunksToBlob', async () => {
    const original = new Uint8Array(CHUNK_SIZE + 500);
    for (let i = 0; i < original.length; i++) original[i] = i % 256;
    const file = new File([original], 'rt.bin');
    const chunks = await fileToChunks(file);
    const blob = chunksToBlob(chunks);
    const recovered = new Uint8Array(await blob.arrayBuffer());
    expect(recovered).toEqual(original);
  });
});
