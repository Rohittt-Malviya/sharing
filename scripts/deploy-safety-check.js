#!/usr/bin/env node
/**
 * Pre-deployment safety check script.
 *
 * Validates that the environment is correctly configured before any production
 * deployment is triggered.  Exits with code 1 on the first failure so CI can
 * block the deployment.
 *
 * Usage:
 *   node scripts/deploy-safety-check.js
 *
 * Set NODE_ENV=production and supply all required env vars before running.
 */

'use strict';

const path = require('path');
const fs = require('fs');

// ── Helpers ───────────────────────────────────────────────────────────────────

let failed = false;

function pass(msg) {
  console.log(`  ✅  ${msg}`);
}

function fail(msg) {
  console.error(`  ❌  ${msg}`);
  failed = true;
}

function section(title) {
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

// ── Checks ────────────────────────────────────────────────────────────────────

section('Environment variables');

const requiredBackendVars = ['FRONTEND_URL'];
for (const varName of requiredBackendVars) {
  if (process.env[varName]) {
    pass(`${varName} is set`);
  } else {
    fail(`${varName} is missing — set it in the deployment environment`);
  }
}

const requiredFrontendVars = ['VITE_BACKEND_URL', 'VITE_SOCKET_URL'];
for (const varName of requiredFrontendVars) {
  if (process.env[varName]) {
    pass(`${varName} is set`);
  } else {
    fail(`${varName} is missing — set it in the deployment environment`);
  }
}

// ── HTTPS enforcement ─────────────────────────────────────────────────────────

section('HTTPS enforcement');

const urlsToCheck = [
  ['FRONTEND_URL', process.env.FRONTEND_URL],
  ['VITE_BACKEND_URL', process.env.VITE_BACKEND_URL],
  ['VITE_SOCKET_URL', process.env.VITE_SOCKET_URL],
];

for (const [name, value] of urlsToCheck) {
  if (!value) continue; // already reported above
  try {
    const url = new URL(value);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      pass(`${name} is localhost (development override allowed)`);
    } else if (url.protocol === 'https:') {
      pass(`${name} uses HTTPS`);
    } else {
      fail(`${name} (${value}) does not use HTTPS — HTTPS is required in production`);
    }
  } catch {
    fail(`${name} (${value}) is not a valid URL`);
  }
}

// ── CORS wildcard check ───────────────────────────────────────────────────────

section('CORS configuration');

const frontendUrl = process.env.FRONTEND_URL || '';
if (frontendUrl.includes('*')) {
  fail('FRONTEND_URL contains a wildcard (*) — this would enable CORS for all origins');
} else if (frontendUrl) {
  pass('FRONTEND_URL does not contain a wildcard');
}

// ── .env files not committed ──────────────────────────────────────────────────

section('.env files');

const root = path.join(__dirname, '..');
const envPaths = [
  path.join(root, '.env'),
  path.join(root, 'backend', '.env'),
  path.join(root, 'frontend', '.env'),
];

for (const envPath of envPaths) {
  const rel = path.relative(root, envPath);
  if (fs.existsSync(envPath)) {
    fail(`${rel} exists in the working tree — ensure it is listed in .gitignore and NOT committed`);
  } else {
    pass(`${rel} not present (correct)`);
  }
}

// ── Production NODE_ENV ───────────────────────────────────────────────────────

section('Runtime environment');

if (process.env.NODE_ENV === 'production') {
  pass('NODE_ENV is set to "production"');
} else {
  fail(`NODE_ENV is "${process.env.NODE_ENV || '(unset)'}" — set to "production" before deploying`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

console.log('\n' + '═'.repeat(55));
if (failed) {
  console.error('❌  Deploy safety check FAILED — fix the issues above before deploying.\n');
  process.exit(1);
} else {
  console.log('✅  All deploy safety checks passed — safe to deploy.\n');
}
