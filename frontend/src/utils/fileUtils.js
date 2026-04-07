/**
 * File chunking utilities
 */

export const CHUNK_SIZE = 64 * 1024; // 64 KB

/**
 * Slice a File/Blob into ArrayBuffer chunks
 * @param {File} file
 * @returns {Promise<ArrayBuffer[]>}
 */
export async function fileToChunks(file) {
  const chunks = [];
  let offset = 0;
  while (offset < file.size) {
    const slice = file.slice(offset, offset + CHUNK_SIZE);
    const buf = await slice.arrayBuffer();
    chunks.push(buf);
    offset += CHUNK_SIZE;
  }
  return chunks;
}

/**
 * Reassemble ArrayBuffer chunks into a Blob
 * @param {ArrayBuffer[]} chunks
 * @param {string} mimeType
 * @returns {Blob}
 */
export function chunksToBlob(chunks, mimeType = 'application/octet-stream') {
  return new Blob(chunks, { type: mimeType });
}

/**
 * Concatenate an array of ArrayBuffers into a single ArrayBuffer.
 * @param {ArrayBuffer[]} buffers
 * @returns {ArrayBuffer}
 */
export function concatenateBuffers(buffers) {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return result.buffer;
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Format seconds to MM:SS
 */
export function formatEta(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format bytes/second to human-readable speed
 */
export function formatSpeed(bytesPerSec) {
  return `${formatBytes(bytesPerSec)}/s`;
}
