'use strict';

class ConsoleAlertSink {
  constructor({ logger } = {}) {
    this.logger = logger;
  }

  async alert({ level = 'warn', type, message, data } = {}) {
    if (this.logger) {
      this.logger.log({ level, type: `alert.${type}`, data: { message, ...data } });
      return;
    }

    // eslint-disable-next-line no-console
    console[level === 'error' ? 'error' : 'warn']({ type, message, data });
  }
}

module.exports = {
  ConsoleAlertSink,
};
