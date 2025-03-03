const Environment = require('jest-environment-jsdom')

// Custom test environment copied from https://github.com/jsdom/jsdom/issues/2524
// in order to add TextEncoder to jsdom. TextEncoder is expected by jose.
module.exports = class CustomTestEnvironment extends Environment {
  async setup() {
    await super.setup()
    if (typeof this.global.TextEncoder === 'undefined') {
      const { TextEncoder, TextDecoder } = require('util')
      this.global.TextEncoder = TextEncoder
      this.global.TextDecoder = TextDecoder
    }
  }
}
