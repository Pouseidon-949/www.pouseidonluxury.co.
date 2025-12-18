'use strict';

const path = require('path');
const { appendJsonlSync, nowIso } = require('./utils');

const DEFAULT_AUDIT_PATH = path.join(process.cwd(), 'var', 'audit.jsonl');

class AuditLogger {
  constructor({ auditPath = DEFAULT_AUDIT_PATH, service = 'poseidon-bot-v2', environment = process.env.NODE_ENV || 'unknown' } = {}) {
    this.auditPath = auditPath;
    this.service = service;
    this.environment = environment;
  }

  log(event) {
    const enriched = {
      ts: nowIso(),
      service: this.service,
      env: this.environment,
      ...event,
    };
    appendJsonlSync(this.auditPath, enriched);

    if (event.level && ['error', 'warn'].includes(event.level)) {
      // eslint-disable-next-line no-console
      console.error(enriched);
    } else {
      // eslint-disable-next-line no-console
      console.log(enriched);
    }
  }

  info(type, data) {
    this.log({ level: 'info', type, data });
  }

  warn(type, data) {
    this.log({ level: 'warn', type, data });
  }

  error(type, data) {
    this.log({ level: 'error', type, data });
  }
}

module.exports = {
  AuditLogger,
  DEFAULT_AUDIT_PATH,
};
