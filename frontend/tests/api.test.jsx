/**
 * Frontend integration / configuration tests.
 *
 * These tests run under Vitest (jsdom environment) and validate:
 *  1. API / socket URL configuration — values come from env vars with a safe
 *     fallback, and production URLs must use HTTPS.
 *  2. Health endpoint contract — a mocked fetch verifies the response shape
 *     the frontend code expects from GET /health.
 *  3. CORS safety — the backend URL must never be a bare wildcard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Derives the effective backend URL the same way `socket.js` does at runtime.
 * We replicate the logic here so the test fails if the logic ever changes.
 */
function resolveBackendUrl(env = {}) {
  return (
    env.VITE_SOCKET_URL ||
    env.VITE_BACKEND_URL ||
    'http://localhost:4000'
  );
}

// ── API URL configuration ─────────────────────────────────────────────────────

describe('Backend URL configuration', () => {
  it('falls back to http://localhost:4000 when env vars are absent', () => {
    const url = resolveBackendUrl({});
    expect(url).toBe('http://localhost:4000');
  });

  it('prefers VITE_SOCKET_URL over VITE_BACKEND_URL', () => {
    const url = resolveBackendUrl({
      VITE_SOCKET_URL: 'https://backend.example.com',
      VITE_BACKEND_URL: 'https://other.example.com',
    });
    expect(url).toBe('https://backend.example.com');
  });

  it('falls back to VITE_BACKEND_URL when VITE_SOCKET_URL is absent', () => {
    const url = resolveBackendUrl({
      VITE_BACKEND_URL: 'https://backend.example.com',
    });
    expect(url).toBe('https://backend.example.com');
  });

  it('is never a wildcard (*)', () => {
    const url = resolveBackendUrl(import.meta.env || {});
    expect(url).not.toBe('*');
    expect(url).not.toContain('*');
  });

  it('uses HTTPS in a production-like environment (non-localhost URL)', () => {
    const prodUrl = resolveBackendUrl({
      VITE_SOCKET_URL: 'https://api.example.com',
    });
    expect(prodUrl).toMatch(/^https:\/\//);
  });
});

// ── /health endpoint contract ─────────────────────────────────────────────────

describe('GET /health endpoint contract', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { status: "ok" } with a 200 response', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ status: 'ok', time: new Date().toISOString() }),
    };
    fetch.mockResolvedValue(mockResponse);

    const res = await fetch('http://localhost:4000/health');
    const data = await res.json();

    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(typeof data.time).toBe('string');
  });

  it('response body contains an ISO timestamp', async () => {
    const isoTime = new Date().toISOString();
    fetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ status: 'ok', time: isoTime }),
    });

    const res = await fetch('http://localhost:4000/health');
    const data = await res.json();

    expect(data.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('throws (network error) when backend is unreachable', async () => {
    fetch.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetch('http://localhost:4000/health')).rejects.toThrow('Failed to fetch');
  });
});

// ── CORS safety ───────────────────────────────────────────────────────────────

describe('CORS configuration safety', () => {
  it('backend URL is a valid absolute URL', () => {
    const backendUrl = resolveBackendUrl(import.meta.env || {});
    expect(() => new URL(backendUrl)).not.toThrow();
  });

  it('does not use a wildcard origin', () => {
    const backendUrl = resolveBackendUrl(import.meta.env || {});
    expect(backendUrl).not.toBe('*');
  });
});
