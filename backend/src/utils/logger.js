'use strict';
const winston = require('winston');
const path = require('path');
const config = require('../config');

const { combine, timestamp, errors, json, colorize, simple } = winston.format;

const transports = [
  new winston.transports.Console({
    format: combine(colorize(), simple()),
  }),
];

if (config.env !== 'test' && config.env !== 'production') {
  // File transport only in development; DO App Platform captures stdout in production
  transports.push(
    new winston.transports.File({
      filename: path.resolve(config.log.file),
      format: combine(timestamp(), errors({ stack: true }), json()),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
    })
  );
}

const logger = winston.createLogger({
  level: config.log.level,
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports,
  exitOnError: false,
});

module.exports = logger;
