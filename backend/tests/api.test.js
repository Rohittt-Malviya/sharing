/**
 * HTTP API tests for the Express server using Node's built-in test runner.
 *
 * These tests spin up the real server on a high ephemeral port so they
 * exercise the full middleware stack (CORS, security headers, rate-limit, etc.)
 * without any mocking.
 *
 * Run with: npm test   (or directly: node --test tests/api.test.js)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_PORT = 4099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

/**
 * Polls the /health endpoint until the server is accepting connections or the
 * timeout elapses.
 */
function waitForServer(port, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    (function poll() {
      http
        .get(`http://localhost:${port}/health`, (res) => {
          // Any HTTP response means the server is up
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() >= deadline) {
            reject(new Error(`Server did not start within ${timeoutMs} ms`));
          } else {
            setTimeout(poll, 200);
          }
        });
    })();
  });
}

/**
 * Makes an HTTP GET request and returns { statusCode, headers, body }.
 */
function httpGet(path, reqHeaders = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path,
      method: 'GET',
      headers: reqHeaders,
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (raw += chunk));
      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
        resolve({ statusCode: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Server lifecycle ──────────────────────────────────────────────────────────

let serverProcess;

const TEST_RATE_LIMIT_MAX = 5; // small limit so the test only fires 6 requests
const TEST_RATE_LIMIT_WINDOW_MS = 10_000; // 10 s window

before(async () => {
  serverProcess = spawn(
    process.execPath, // use the same node binary
    [path.join(__dirname, '..', 'server.js')],
    {
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        NODE_ENV: 'test',
        FRONTEND_URL: 'http://localhost:5173',
        RATE_LIMIT_MAX: String(TEST_RATE_LIMIT_MAX),
        RATE_LIMIT_WINDOW_MS: String(TEST_RATE_LIMIT_WINDOW_MS),
      },
      stdio: 'pipe',
    }
  );

  serverProcess.stderr.on('data', () => {}); // suppress stderr noise in test output
  serverProcess.stdout.on('data', () => {});

  await waitForServer(TEST_PORT);
});

after(() => {
  if (serverProcess) serverProcess.kill('SIGTERM');
});

// ── Test suites ───────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with { status: "ok" }', async () => {
    const { statusCode, body } = await httpGet('/health');
    assert.equal(statusCode, 200);
    assert.equal(body.status, 'ok');
    assert.ok(typeof body.time === 'string', 'should include ISO timestamp');
  });
});

describe('Security headers', () => {
  it('sets X-Content-Type-Options: nosniff', async () => {
    const { headers } = await httpGet('/health');
    assert.equal(headers['x-content-type-options'], 'nosniff');
  });

  it('sets X-Frame-Options: DENY', async () => {
    const { headers } = await httpGet('/health');
    assert.equal(headers['x-frame-options'], 'DENY');
  });

  it('sets X-XSS-Protection header', async () => {
    const { headers } = await httpGet('/health');
    assert.ok(
      headers['x-xss-protection'],
      'X-XSS-Protection header should be present'
    );
  });

  it('sets Referrer-Policy header', async () => {
    const { headers } = await httpGet('/health');
    assert.ok(
      headers['referrer-policy'],
      'Referrer-Policy header should be present'
    );
  });

  it('sets Content-Security-Policy header', async () => {
    const { headers } = await httpGet('/health');
    assert.ok(
      headers['content-security-policy'],
      'Content-Security-Policy header should be present'
    );
  });
});

describe('CORS', () => {
  it('allows requests from the configured origin', async () => {
    const { headers } = await httpGet('/health', {
      Origin: 'http://localhost:5173',
    });
    assert.equal(
      headers['access-control-allow-origin'],
      'http://localhost:5173'
    );
  });

  it('does not echo back an arbitrary origin', async () => {
    const { headers } = await httpGet('/health', {
      Origin: 'https://evil.example.com',
    });
    assert.notEqual(
      headers['access-control-allow-origin'],
      'https://evil.example.com',
      'Server must not allow arbitrary origins'
    );
  });

  it('does not set wildcard CORS origin', async () => {
    const { headers } = await httpGet('/health');
    assert.notEqual(
      headers['access-control-allow-origin'],
      '*',
      'Wildcard CORS origin must not be used'
    );
  });
});

describe('Rate limiting', () => {
  it('returns 429 after exceeding the request limit', async () => {
    // Fire TEST_RATE_LIMIT_MAX + 1 requests; the last one must be rejected.
    let last;
    for (let i = 0; i < TEST_RATE_LIMIT_MAX + 1; i++) {
      last = await httpGet('/health');
      if (last.statusCode === 429) break;
    }
    assert.equal(
      last.statusCode,
      429,
      'Server should return 429 after limit exceeded'
    );
    assert.equal(
      last.body.error.code,
      'RATE_LIMIT_EXCEEDED',
      'Error code should be RATE_LIMIT_EXCEEDED'
    );
  });
});
