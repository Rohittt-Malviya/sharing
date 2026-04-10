/**
 * Centralised file-upload validation.
 *
 * All upload entry-points (Home, HeroSection, SenderPage) import from this
 * single module so the size limit, blocked-type list, and error messages
 * remain consistent across the whole application.
 */

import { formatBytes } from './fileUtils';

/** Maximum transferable file size (2 GiB). */
export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024;

/** Human-readable label shown in error messages. */
export const MAX_FILE_SIZE_LABEL = '2 GB';

/**
 * Windows executables and interpreter-driven scripts that can auto-execute
 * on the receiving machine without explicit user intent.
 *
 * Shell scripts (.sh, .bash, .zsh, etc.) are intentionally NOT blocked
 * because they are plain-text files on most systems and have legitimate
 * transfer use-cases.
 */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi',
  'scr', 'pif', 'cpl',
  'ps1', 'vbs', 'vbe', 'wsf', 'hta',
]);

/**
 * Validate a {@link File} object before it is accepted for transfer.
 *
 * Checks (in order):
 *  1. File is not null/undefined.
 *  2. File is not empty (0 bytes).
 *  3. File does not exceed {@link MAX_FILE_SIZE}.
 *  4. File extension is not in the blocked-executables list.
 *
 * @param {File|null|undefined} file
 * @returns {{ valid: true } | { valid: false; error: string }}
 */
export function validateFile(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'The selected file is empty (0 bytes) and cannot be transferred.',
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large (${formatBytes(file.size)}). Maximum allowed size is ${MAX_FILE_SIZE_LABEL}.`,
    };
  }

  const dotIndex = file.name.lastIndexOf('.');
  const ext = dotIndex !== -1 ? file.name.slice(dotIndex + 1).toLowerCase() : '';
  if (ext && BLOCKED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `".${ext}" files cannot be transferred for security reasons.`,
    };
  }

  return { valid: true };
}
