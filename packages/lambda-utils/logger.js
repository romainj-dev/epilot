function logWithLevel(level, message, meta) {
  if (meta && Object.keys(meta).length > 0) {
    console[level](message, meta)
    return
  }
  console[level](message)
}

const logger = {
  info(message, meta) {
    logWithLevel('log', message, meta)
  },
  warn(message, meta) {
    logWithLevel('warn', message, meta)
  },
  error(message, meta) {
    logWithLevel('error', message, meta)
  },
}

module.exports = logger
