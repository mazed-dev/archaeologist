/** @jsxImportSource @emotion/react */

import React from 'react'

import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useParams,
  useLocation,
} from 'react-router-dom'

import { css } from '@emotion/react'

import { Card, Container } from 'react-bootstrap'
import { PostHog } from 'posthog-js'
import { useAsyncEffect } from 'use-async-effect'
import { parse } from 'query-string'

import { Triptych } from './card/Triptych'
import { SearchGridView } from './grid/SearchGridView'

import { GlobalNavBar } from './navbar/GlobalNavBar'
import { Login } from './auth/Login'
import { Logout } from './auth/Logout'
import { Signup } from './account/create/Signup'
import { PasswordChange } from './auth/PasswordChange'
import { PasswordRecoverForm } from './auth/PasswordRecoverForm'
import { PasswordRecoverRequest } from './auth/PasswordRecoverRequest'
import { Notice } from './notice/Notice.js'
import { Onboarding } from './account/onboard/Onboarding'
import {
  PasswordRecoverFormUrlParams,
  TriptychUrlParams,
  truthsayerPath,
  goto,
} from './lib/route'
import {
  ExternalImport,
  ExternalImportProgress,
} from './external-import/ExternalImport'
import { Export } from './export/Export'
import { AppsList } from './apps-list/AppsList'
import { AppHead } from './AppHead'

import { MzdGlobal } from './lib/global'
import { ContactUs, CookiePolicyPopUp } from './public-page/legal/Index'
import { PublicPage } from './public-page/PublicPage'
import {
  AnalyticsIdentity,
  errorise,
  log,
  productanalytics,
  sleep,
} from 'armoury'
import { ApplicationSettings } from './AppSettings'
import {
  AccountInterface,
  authCookie,
  createUserAccount,
  UserAccount,
} from 'smuggler-api'
import { KnockerElement } from './auth/Knocker'
import {
  BackgroundActionProgress,
  FromArchaeologistContent,
  FromTruthsayer,
  ToTruthsayer,
} from 'truthsayer-archaeologist-communication'
import { ArchaeologistState } from './apps-list/archaeologistState'
import { BrowserHistoryImporterLoadingScreen } from './external-import/BrowserHistoryImporterLoadingScreen'

function isAuthenticated(account: AccountInterface): account is UserAccount {
  return account.isAuthenticated()
}

export function App() {
  return (
    <>
      <KnockerElement />
      <AppHead />
      <AppRouter />
    </>
  )
}

function AppRouter() {
  const analytics = React.useMemo<PostHog | null>(() => {
    const { analytics } = productanalytics.make(
      'truthsayer',
      process.env.NODE_ENV
    )
    return analytics
  }, [])

  const [account, setAccount] = React.useState<UserAccount | null>(null)
  useAsyncEffect(async () => {
    if (account != null) {
      return
    }
    const acc = await createUserAccount()
    if (!isAuthenticated(acc)) {
      log.warning(
        "Failed to initialise user account, most functionality won't work until the page reloads"
      )
      return
    }
    log.info('Initialised an authenticated user account')
    setAccount(acc)
  }, [])
  const [archaeologistState, setArchaeologistState] =
    React.useState<ArchaeologistState>({ state: 'loading' })
  useAsyncEffect(async () => {
    try {
      const result = await waitForArchaeologistToLoad()
      analytics?.identify(result.analyticsIdentity.analyticsIdentity)
      setArchaeologistState({
        state: 'installed',
        version: result.version,
      })
    } catch (err) {
      setArchaeologistState({ state: 'not-installed' })
    }
  }, [])

  const [historyImportProgress, setHistoryImportProgress] =
    React.useState<BackgroundActionProgress>({
      processed: 0,
      total: 0,
    })
  const [openTabsImportProgress, setOpenTabsProgress] =
    React.useState<BackgroundActionProgress>({
      processed: 0,
      total: 0,
    })
  const externalImportProgress: ExternalImportProgress = {
    historyImportProgress,
    openTabsProgress: openTabsImportProgress,
  }
  React.useEffect(() => {
    const listener = (
      event: MessageEvent
    ): void /**this messaging channel doesn't natively support posting back responses*/ => {
      // Only accept messages sent from archaeologist's content script
      // eslint-disable-next-line eqeqeq
      if (event.source != window) {
        return
      }

      // Discard any events that are not part of truthsayer/archaeologist
      // business logic communication
      const request = event.data
      if (!FromArchaeologistContent.isRequest(request)) {
        return
      }

      switch (request.type) {
        case 'REPORT_BACKGROUND_OPERATION_PROGRESS': {
          switch (request.operation) {
            case 'open-tabs-upload': {
              setOpenTabsProgress(request.newState)
              break
            }
            case 'browser-history-upload': {
              setHistoryImportProgress(request.newState)
              break
            }
          }
        }
      }
    }
    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  })

  const isLikelyAuthorised = authCookie.veil.check()

  return (
    <Router>
      {analytics != null ? (
        <PageviewEventTracker analytics={analytics} />
      ) : null}
      <CookiePolicyPopUp />
      <GlobalNavBar
        isLikelyAuthorised={isLikelyAuthorised}
        account={account ?? undefined}
      />
      <Container
        fluid
        className="app_content"
        css={css`
          max-width: 100%;
          width: 100%;
          margin: 0;
          padding: 0;

          font-family: 'Roboto', arial, sans-serif;
          font-style: normal;
          font-weight: 400;

          @media (min-width: 480px) {
            .app_content {
              padding-left: 4px;
              /* Reserve space for scrollbar on the right side */
              padding-right: 6px;
            }
          }
        `}
      >
        <MzdGlobal
          account={account ?? undefined}
          analytics={analytics ?? undefined}
        >
          <Routes>
            <Route path="/">
              <Route index element={<Navigate to="/search" />} />
              <Route
                path={truthsayerPath('/apps-to-install')}
                element={
                  <PublicPage>
                    <AppsList archaeologist={archaeologistState} />
                  </PublicPage>
                }
              />
              <Route
                path={truthsayerPath('/help')}
                element={
                  <PublicPage>
                    <HelpInfo />
                  </PublicPage>
                }
              />
              <Route
                path={truthsayerPath('/about')}
                Component={() => goto.about()}
              />
              <Route
                path={truthsayerPath('/contacts')}
                element={
                  <PublicPage>
                    <ContactUs />
                  </PublicPage>
                }
              />
              <Route
                path={truthsayerPath('/notice/:page')}
                element={
                  <PublicPage>
                    <Notice />
                  </PublicPage>
                }
              />
              <Route
                path={truthsayerPath('/cookie-policy')}
                Component={() => goto.cookiePolicy()}
              />
              <Route
                path={truthsayerPath('/privacy-policy')}
                Component={() => goto.privacy()}
              />
              <Route
                path={truthsayerPath('/terms-of-service')}
                Component={() => goto.terms()}
              />
              <Route
                path={truthsayerPath('/login')}
                element={
                  <PublicOnlyPage isLikelyAuthorised={isLikelyAuthorised}>
                    <PublicPage>
                      <Login />
                    </PublicPage>
                  </PublicOnlyPage>
                }
              />
              <Route
                path={truthsayerPath('/signup')}
                element={
                  <PublicOnlyPage isLikelyAuthorised={isLikelyAuthorised}>
                    <PublicPage>
                      <Signup />
                    </PublicPage>
                  </PublicOnlyPage>
                }
              />
              <Route
                path={truthsayerPath('/password-recover-request')}
                element={
                  <PublicOnlyPage isLikelyAuthorised={isLikelyAuthorised}>
                    <PublicPage>
                      <PasswordRecoverRequest />
                    </PublicPage>
                  </PublicOnlyPage>
                }
              />
              <Route
                path={truthsayerPath('/password-recover-reset/:token')}
                element={
                  <PublicOnlyPage isLikelyAuthorised={isLikelyAuthorised}>
                    <PublicPage>
                      <PasswordRecoverFormView />
                    </PublicPage>
                  </PublicOnlyPage>
                }
              />
              <Route
                path={truthsayerPath('/')}
                element={<Navigate to={{ pathname: '/search' }} />}
              />
              <Route
                path={truthsayerPath('/search')}
                element={
                  <SearchGridView archaeologistState={archaeologistState} />
                }
              />
              <Route
                path={truthsayerPath('/account')}
                element={
                  <PrivateOnlyPage isLikelyAuthorised={isLikelyAuthorised}>
                    <AccountView />
                  </PrivateOnlyPage>
                }
              />
              <Route
                path={truthsayerPath('/external-import')}
                element={
                  <PrivateOnlyPage isLikelyAuthorised={isLikelyAuthorised}>
                    <ExternalImport
                      archaeologistState={archaeologistState}
                      progress={externalImportProgress}
                      browserHistoryImportConfig={{
                        modes: ['untracked', 'resumable'],
                      }}
                    />
                  </PrivateOnlyPage>
                }
              />
              <Route path={truthsayerPath('/export')} element={<Export />} />
              <Route
                path={truthsayerPath('/password-recover-change')}
                element={
                  <PrivateOnlyPage isLikelyAuthorised={isLikelyAuthorised}>
                    <PasswordChange />
                  </PrivateOnlyPage>
                }
              />
              <Route
                path={truthsayerPath('/n/:nid')}
                element={<TriptychView />}
              />
              <Route
                path={truthsayerPath('/settings')}
                element={
                  <ApplicationSettings
                    archaeologistState={archaeologistState}
                    isLikelyAuthorised={isLikelyAuthorised}
                  />
                }
              />
              <Route
                path={truthsayerPath('/logout')}
                element={
                  <PrivateOnlyPage isLikelyAuthorised={isLikelyAuthorised}>
                    <Logout />
                  </PrivateOnlyPage>
                }
              />
              <Route
                path={truthsayerPath('/onboarding')}
                element={
                  <Onboarding
                    archaeologistState={archaeologistState}
                    progress={externalImportProgress}
                  />
                }
              />
              <Route
                path={truthsayerPath('/browser-history-import-loading-screen')}
                element={
                  <BrowserHistoryImporterLoadingScreen
                    progress={historyImportProgress}
                  />
                }
              />
              <Route path="*" element={<Navigate to={{ pathname: '/' }} />} />
            </Route>
          </Routes>
        </MzdGlobal>
      </Container>
    </Router>
  )
}

function PublicOnlyPage({
  children,
  isLikelyAuthorised,
}: React.PropsWithChildren<{ isLikelyAuthorised: boolean }>) {
  if (isLikelyAuthorised) {
    return <Navigate to="/" />
  }
  return <>{children}</>
}

function PrivateOnlyPage({
  children,
  isLikelyAuthorised,
}: React.PropsWithChildren<{
  isLikelyAuthorised: boolean
}>) {
  if (!isLikelyAuthorised) {
    return <Navigate to="/" />
  }
  return <>{children}</>
}

function HelpInfo() {
  return (
    <Container>
      <h2>All support topics</h2>
      <Card>
        <Card.Body>
          <Card.Title>To be done</Card.Title>
          <Card.Text>To be done</Card.Text>
        </Card.Body>
      </Card>
    </Container>
  )
}

function AccountView() {
  return (
    <div>
      <h2>Account</h2>
    </div>
  )
}

function PasswordRecoverFormView() {
  const { token } = useParams<PasswordRecoverFormUrlParams>()
  const loc = useLocation()
  if (token == null) {
    return <Navigate to="/" />
  }
  const onboarding = 'onboarding' in parse(loc.search)
  return <PasswordRecoverForm token={token} onboarding={onboarding} />
}

function TriptychView() {
  // We can use the `useParams` hook here to access
  // the dynamic pieces of the URL.
  const { nid } = useParams<TriptychUrlParams>()
  if (nid == null) {
    return <Navigate to="/" />
  }
  return <Triptych nid={nid} />
}

// Based on https://www.sheshbabu.com/posts/automatic-pageview-tracking-using-react-router/
function PageviewEventTracker({ analytics }: { analytics: PostHog }) {
  const location = useLocation()
  React.useEffect(() => {
    // See https://posthog.com/docs/integrate/client/js#one-page-apps-and-page-views
    // for more information about pageview events in PostHog
    analytics.capture('$pageview')
  }, [location, analytics])
  return <div />
}

async function waitForArchaeologistToLoad(): Promise<{
  version: ToTruthsayer.ArchaeologistVersion
  analyticsIdentity: AnalyticsIdentity
}> {
  const maxAttempts = 5
  let error = ''
  for (let attempt = 0; attempt < maxAttempts; ++attempt) {
    try {
      const response = await FromTruthsayer.sendMessage({
        type: 'GET_ARCHAEOLOGIST_STATE_REQUEST',
      })
      return {
        version: response.version,
        analyticsIdentity: response.analyticsIdentity,
      }
    } catch (reason) {
      if (attempt === maxAttempts - 1) {
        error = errorise(reason).message
      }
    }
    await sleep(200 /* ms */)
  }
  throw new Error(
    `Failed to get archaeologist state after ${maxAttempts} attempts. ` +
      `Last error: ${error}`
  )
}
