// Global mock for electron-log in unit tests.
// electron-log initializes platform-specific log paths at import time,
// which fails when running Jest outside of an Electron context.
const noop = () => {}
const log = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  silly: noop,
  verbose: noop,
}
module.exports = log
module.exports.default = log
