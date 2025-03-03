import lodash from 'lodash'
import moment from 'moment'

export namespace unicodeText {
  export function getWordCount(plaintext: string): number {
    return plaintext.match(/\p{L}+/gu)?.length || 0
  }

  export function getTimeToRead(plaintext: string): moment.Duration {
    // 240 words per minute is an average reading spead in English, so we take
    // it as a solution to-go. We shall adjeust it based on language and each
    // individual user.
    return moment.duration(getWordCount(plaintext) / 240, 'minutes')
  }

  /**
   * Removes leading, trailing and repeated spaces in text.
   */
  export function trimWhitespace(text: string): string {
    text = text.trim()
    text = text.replace(
      /[\u00B6\u2202\u2000-\u200B\u202F\u205F\u3000\uFEFF\s]{2,}/g,
      ' '
    )
    return text
  }

  export const kTruncateSeparatorUChar = /./u
  export const kTruncateSeparatorSpace = /\s/

  export function truncate(
    text: string,
    limit: number,
    separator?: RegExp | string,
    omission?: string
  ): string {
    return lodash.truncate(text, {
      length: limit,
      omission: omission ?? '',
      separator: separator ?? kTruncateSeparatorUChar,
    })
  }
}
