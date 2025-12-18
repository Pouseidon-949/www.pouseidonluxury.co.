'use strict';

const fs = require('fs');
const path = require('path');

function ensureDirSync(dirPath) {
  if (!dirPath) return;
  if (fs.existsSync(dirPath)) return;
  fs.mkdirSync(dirPath, { recursive: true });
}

function safeJsonStringify(value) {
  return JSON.stringify(
    value,
    (_k, v) => {
      if (typeof v === 'bigint') return v.toString();
      if (v instanceof Error) {
        return {
          name: v.name,
          message: v.message,
          stack: v.stack,
        };
      }
      return v;
    },
    0
  );
}

function appendJsonlSync(filePath, obj) {
  ensureDirSync(path.dirname(filePath));
  fs.appendFileSync(filePath, `${safeJsonStringify(obj)}\n`, 'utf8');
}

function nowIso() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampInt(n, min, max) {
  const x = Math.trunc(n);
  return Math.max(min, Math.min(max, x));
}

module.exports = {
  ensureDirSync,
  safeJsonStringify,
  appendJsonlSync,
  nowIso,
  sleep,
  clampInt,
};
