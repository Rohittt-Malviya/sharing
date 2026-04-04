/**
 * File service.
 *
 * Centralises file-related operations — chunking, encryption, decryption,
 * reassembly and download — so pages stay thin and focused on UI state.
 */
import { fileToChunks, chunksToBlob } from '../utils/fileUtils'
import { generateKey, exportKey, importKey, encryptData, decryptData } from '../utils/crypto'

/** Maximum allowed file size (2 GB). */
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024

/**
 * Validate a File object for basic constraints.
 * Returns null on success, or an error message string on failure.
 * @param {File} file
 * @returns {string|null}
 */
export function validateFile(file) {
  if (!file) return 'No file selected.'
  if (file.size === 0) return 'File is empty.'
  if (file.size > MAX_FILE_SIZE) {
    const gb = (MAX_FILE_SIZE / (1024 ** 3)).toFixed(0)
    return `File is too large. Maximum allowed size is ${gb} GB.`
  }
  return null
}

/**
 * Prepare a file for transmission:
 * 1. Generate a fresh AES-GCM key.
 * 2. Export the key as Base64 (to share via data channel metadata).
 * 3. Chunk the file into 64 KB ArrayBuffers.
 * 4. Return everything the sender needs.
 *
 * @param {File} file
 * @returns {Promise<{ key: CryptoKey; exportedKey: string; chunks: ArrayBuffer[] }>}
 */
export async function prepareFileSend(file) {
  const key = await generateKey()
  const exportedKey = await exportKey(key)
  const chunks = await fileToChunks(file)
  return { key, exportedKey, chunks }
}

/**
 * Build the metadata message to send over the data channel before chunks.
 * @param {File} file
 * @param {string} exportedKey
 * @returns {string} JSON string ready to pass to `dc.send()`
 */
export function buildMetadataMessage(file, exportedKey) {
  return JSON.stringify({
    type: 'metadata',
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    encryptionKey: exportedKey,
  })
}

/**
 * Encrypt a single chunk with the given CryptoKey.
 * @param {CryptoKey} key
 * @param {ArrayBuffer} chunk
 * @returns {Promise<ArrayBuffer>}
 */
export function encryptChunk(key, chunk) {
  return encryptData(key, chunk)
}

/**
 * Decrypt a single received chunk.
 * @param {string} base64Key - The exported key received in the metadata message
 * @param {ArrayBuffer} data
 * @returns {Promise<ArrayBuffer>}
 */
export async function decryptChunk(base64Key, data) {
  const key = await importKey(base64Key)
  return decryptData(key, data)
}

/**
 * Reassemble received chunks into a Blob and create a temporary object URL.
 * Remember to call `URL.revokeObjectURL(url)` when done.
 *
 * @param {ArrayBuffer[]} chunks
 * @param {string} mimeType
 * @returns {{ blob: Blob; url: string }}
 */
export function finalizeReceivedFile(chunks, mimeType) {
  const blob = chunksToBlob(chunks, mimeType)
  const url = URL.createObjectURL(blob)
  return { blob, url }
}

/**
 * Trigger a browser download for a file URL.
 * @param {string} url - Object URL
 * @param {string} fileName - Download filename
 */
export function triggerDownload(url, fileName) {
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
}

export default {
  MAX_FILE_SIZE,
  validateFile,
  prepareFileSend,
  buildMetadataMessage,
  encryptChunk,
  decryptChunk,
  finalizeReceivedFile,
  triggerDownload,
}
