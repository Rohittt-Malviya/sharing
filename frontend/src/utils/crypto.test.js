import { describe, it, expect } from 'vitest';
import {
  generateKey,
  exportKey,
  importKey,
  encryptData,
  decryptData,
  bufferToBase64,
  base64ToBuffer,
  hashBuffer,
} from '../utils/crypto';

// ─── bufferToBase64 / base64ToBuffer ─────────────────────────────────────────

describe('bufferToBase64 / base64ToBuffer', () => {
  it('encodes an empty buffer to an empty string', () => {
    expect(bufferToBase64(new ArrayBuffer(0))).toBe('');
  });

  it('round-trips arbitrary bytes', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255, 42, 7]);
    const b64 = bufferToBase64(original.buffer);
    expect(typeof b64).toBe('string');
    const recovered = new Uint8Array(base64ToBuffer(b64));
    expect(recovered).toEqual(original);
  });

  it('produces a valid base64 string (only valid chars)', () => {
    const buf = new Uint8Array(64).fill(0xcc).buffer;
    const b64 = bufferToBase64(buf);
    expect(b64).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('base64ToBuffer inverts bufferToBase64 for 256-byte payload', () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i++) original[i] = i;
    const recovered = new Uint8Array(base64ToBuffer(bufferToBase64(original.buffer)));
    expect(recovered).toEqual(original);
  });
});

// ─── generateKey ─────────────────────────────────────────────────────────────

describe('generateKey', () => {
  it('returns a CryptoKey object', async () => {
    const key = await generateKey();
    expect(key).toBeInstanceOf(CryptoKey);
  });

  it('produces an AES-GCM, 256-bit, extractable key usable for encrypt/decrypt', async () => {
    const key = await generateKey();
    expect(key.algorithm.name).toBe('AES-GCM');
    expect(key.algorithm.length).toBe(256);
    expect(key.extractable).toBe(true);
    expect(key.usages).toContain('encrypt');
    expect(key.usages).toContain('decrypt');
  });

  it('generates different keys on each call', async () => {
    const [k1, k2] = await Promise.all([generateKey(), generateKey()]);
    const [e1, e2] = await Promise.all([exportKey(k1), exportKey(k2)]);
    expect(e1).not.toBe(e2);
  });
});

// ─── exportKey / importKey ────────────────────────────────────────────────────

describe('exportKey / importKey', () => {
  it('exportKey returns a non-empty base64 string', async () => {
    const key = await generateKey();
    const exported = await exportKey(key);
    expect(typeof exported).toBe('string');
    expect(exported.length).toBeGreaterThan(0);
  });

  it('importKey restores a CryptoKey from an exported base64 string', async () => {
    const key = await generateKey();
    const exported = await exportKey(key);
    const imported = await importKey(exported);
    expect(imported).toBeInstanceOf(CryptoKey);
    expect(imported.algorithm.name).toBe('AES-GCM');
  });

  it('imported key round-trips through export → import producing the same raw bytes', async () => {
    const key = await generateKey();
    const exported = await exportKey(key);
    const imported = await importKey(exported);
    const reExported = await exportKey(imported);
    expect(reExported).toBe(exported);
  });
});

// ─── encryptData / decryptData ────────────────────────────────────────────────

describe('encryptData / decryptData', () => {
  it('encryptData returns an ArrayBuffer larger than the input (IV overhead)', async () => {
    const key = await generateKey();
    const plain = new TextEncoder().encode('hello world').buffer;
    const encrypted = await encryptData(key, plain);
    expect(encrypted).toBeInstanceOf(ArrayBuffer);
    expect(encrypted.byteLength).toBeGreaterThan(plain.byteLength);
  });

  it('decryptData recovers the original plaintext', async () => {
    const key = await generateKey();
    const plainText = 'WebRTC P2P file sharing test payload';
    const plain = new TextEncoder().encode(plainText).buffer;
    const encrypted = await encryptData(key, plain);
    const decrypted = await decryptData(key, encrypted);
    const recovered = new TextDecoder().decode(decrypted);
    expect(recovered).toBe(plainText);
  });

  it('encrypting the same data twice produces different ciphertexts (random IV)', async () => {
    const key = await generateKey();
    const plain = new TextEncoder().encode('test').buffer;
    const [c1, c2] = await Promise.all([encryptData(key, plain), encryptData(key, plain)]);
    expect(bufferToBase64(c1)).not.toBe(bufferToBase64(c2));
  });

  it('decryption with a different key throws', async () => {
    const key1 = await generateKey();
    const key2 = await generateKey();
    const plain = new TextEncoder().encode('secret').buffer;
    const encrypted = await encryptData(key1, plain);
    await expect(decryptData(key2, encrypted)).rejects.toThrow();
  });

  it('round-trips a large binary payload (256 KB)', async () => {
    const key = await generateKey();
    const original = new Uint8Array(256 * 1024);
    for (let i = 0; i < original.length; i++) original[i] = i % 256;
    const encrypted = await encryptData(key, original.buffer);
    const decrypted = await decryptData(key, encrypted);
    expect(new Uint8Array(decrypted)).toEqual(original);
  });

  it('can use an imported key to decrypt data encrypted with the original key', async () => {
    const key = await generateKey();
    const exported = await exportKey(key);
    const importedKey = await importKey(exported);
    const plain = new TextEncoder().encode('cross-key test').buffer;
    const encrypted = await encryptData(key, plain);
    const decrypted = await decryptData(importedKey, encrypted);
    expect(new TextDecoder().decode(decrypted)).toBe('cross-key test');
  });
});

// ─── hashBuffer ───────────────────────────────────────────────────────────────

describe('hashBuffer', () => {
  it('returns a 64-character lowercase hex string (SHA-256)', async () => {
    const buf = new TextEncoder().encode('hello').buffer;
    const hash = await hashBuffer(buf);
    expect(typeof hash).toBe('string');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it('matches the well-known SHA-256 of "hello"', async () => {
    const buf = new TextEncoder().encode('hello').buffer;
    const hash = await hashBuffer(buf);
    expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('produces different hashes for different inputs', async () => {
    const h1 = await hashBuffer(new TextEncoder().encode('abc').buffer);
    const h2 = await hashBuffer(new TextEncoder().encode('abd').buffer);
    expect(h1).not.toBe(h2);
  });

  it('is deterministic – same input always yields same hash', async () => {
    const buf = new Uint8Array([10, 20, 30, 40, 50]).buffer;
    const [h1, h2] = await Promise.all([hashBuffer(buf), hashBuffer(buf)]);
    expect(h1).toBe(h2);
  });

  it('handles an empty buffer', async () => {
    const hash = await hashBuffer(new ArrayBuffer(0));
    // SHA-256("") = e3b0c44298fc1c149...
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
});
