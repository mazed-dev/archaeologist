import {
  _isArticleUrl,
  _isManuallyAllowed,
  _isManuallyBlocked,
  _isTitleOfNotFoundPage,
} from './autosaveable'

test('Autosaveable.homepage', () => {
  ;[
    'https://stackoverflow.com/',
    'https://youtube.com/',
    'https://stackoverflow.com/index.html',
  ].forEach((url) => {
    expect(_isArticleUrl(new URL(url))).toStrictEqual(false)
  })
})
test('Autosaveable.homepage-not', () => {
  ;[
    'https://akindyakov.dev/routine-and-recipes/',
    'https://firefox-source-docs.mozilla.org/devtools-user/about_colon_debugging/index.html',
    'https://domains.google.com/registrar/index.php',
  ].forEach((url) => {
    expect(_isArticleUrl(new URL(url))).toStrictEqual(true)
  })
})
test('Autosaveable.manually-blocked', () => {
  ;[
    'https://docs.google.com/document/d/45W',
    'https://github.com/Thread-knowledge/truthsayer/pull/241/commits',
    'https://github.com/mazed-dev/truthsayer/pull/179/files',
    'https://github.com/mazed_dev/truthsayer_/pull/1/files',
    'https://abc.com/forgot/signin',
    'https://abc.com/SIGNUP',
    'https://abc.com/forgot/signup/',
    'https://abc.com/forgot/login/abc',
    'https://abc.com/forgot/Login',
    'https://abc.com/forgot/LogIn',
    'https://roamresearch.com/#/signin',
    'https://eventbrite.co.uk/signin/signup/?referrer=abc',
    'https://zoom.us/oauth/signin?_rnd=166',
    'https://zoom.us/oauth/signin/?_rnd=166',
    'https://residentportal.com/auth',
    'https://github.com/Thread-knowledge/smuggler/compare/add-meta-node-idx-for-slice-search?expand=1',
    'https://outlook.live.com/mail/0/inbox/id/AQQkADAwATMwMAItM2JmMy01NQBlMC0wMAI',
    'https://mail.google.com/mail/u/0/#drafts',
    'https://www.amazon.co.uk/h/mobile/mission',
    'https://amazon.co.uk/h/mobile',
    'https://www.amazon.com/Laura-Mercier-Pencil/dp/B07X',
  ].forEach((url) => {
    expect(_isManuallyBlocked(url)).toStrictEqual(true)
  })
  ;['https://github.com/Thread-knowledge/truthsayer/pull/241'].forEach(
    (url) => {
      expect(_isManuallyBlocked(url)).toStrictEqual(false)
    }
  )
})
test('Autosaveable.manually-allowed', () => {
  ;[].forEach((url) => {
    expect(_isManuallyAllowed(url)).toStrictEqual(true)
  })
})
test('Autosaveable.title-of-not-found-page', () => {
  ;[
    'Error 404 (Not Found)!!1',
    'Error Page | AXA Health',
    'Error 403 (Forbidden)!!1',
    '404 - Page Not Found',
    'Page cannot be found',
  ].forEach((title) => {
    expect(_isTitleOfNotFoundPage(title)).toStrictEqual(true)
  })
  ;[
    'bootstrap for browser history',
    'lost dog still not found',
    'tourist climbs stairs of 404 steps',
    'Blizzard will be taking Overwatch 2 offline again',
  ].forEach((title) => {
    expect(_isTitleOfNotFoundPage(title)).toStrictEqual(false)
  })
})
