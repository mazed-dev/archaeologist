import React from 'react'

import {
  Card,
  Button,
  Form,
  Container,
  Row,
  Col,
  ButtonGroup,
} from 'react-bootstrap'

import { Emoji } from './../lib/Emoji'
import { authentication } from 'smuggler-api'
import { useNavigate, NavigateFunction } from 'react-router-dom'

type PasswordRecoverRequestPros = {
  navigate: NavigateFunction
}
type PasswordRecoverRequestState = {
  email: string
  reset_request_is_sent: boolean
  isReady: boolean
}

class PasswordRecoverRequestImpl extends React.Component<
  PasswordRecoverRequestPros,
  PasswordRecoverRequestState
> {
  emailRef: React.RefObject<HTMLInputElement>
  abortControler: AbortController

  constructor(props: PasswordRecoverRequestPros) {
    super(props)
    this.state = {
      email: '',
      reset_request_is_sent: false,
      isReady: false,
    }
    this.emailRef = React.createRef()
    this.abortControler = new AbortController()
  }

  componentDidMount() {
    // Just in case we are already logged in
    // TODO(akindyakov): Check that user is logged in here
    // axios
    //   .get('/api/auth/session', {
    //     signal: this.abortControler.signal,
    //   })
    //   .then((res) => {
    //     if (res) {
    //       this.props.history.push('/')
    //     }
    //   })
  }

  componentWillUnmount() {
    this.abortControler.abort()
  }

  handleEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({ email: event.target.value })
    this.checkState()
  }

  checkState = () => {
    if (this.emailRef.current) {
      const isReady = this.emailRef.current.validity.valid
      this.setState({ isReady })
    }
  }

  onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    authentication.user.password
      .recover({
        email: this.state.email,
        signal: this.abortControler.signal,
      })
      .then(
        (res) => {
          if (res) {
            this.setState({
              reset_request_is_sent: true,
            })
          }
        },
        (err) => {
          alert(`Error ${err}`)
        }
      )
  }

  onGoBackToMain = () => {
    this.props.navigate('/')
  }

  render() {
    let show
    if (this.state.reset_request_is_sent) {
      show = (
        <>
          <Card.Text>
            Password request is successfully submitted &nbsp;
            <Emoji symbol="👍" label="!" />
          </Card.Text>
          <Card.Text>
            We will reach you out as soon as possible and provide an instruction
            of how to reset your password.
          </Card.Text>
          <Card.Text>
            Sincerely yours, Foreword team &nbsp;
            <Emoji symbol="🤓" label=":D" />
          </Card.Text>
          <ButtonGroup>
            <Button variant="outline-secondary" onClick={this.onGoBackToMain}>
              Go back
            </Button>
          </ButtonGroup>
        </>
      )
    } else {
      show = (
        <>
          <Card.Text>
            Please provide us a primary email &nbsp;
            <Emoji symbol="📨" label="email" />
            &nbsp; associated with your Foreword account so we can contact you
            and provide a password reset instruction
          </Card.Text>
          <Form className="m-4" onSubmit={this.onSubmit}>
            <Form.Group as={Row} controlId="formLoginEmail">
              <Form.Label column sm="2">
                Email
              </Form.Label>
              <Col>
                <Form.Control
                  type="email"
                  value={this.state.email}
                  onChange={this.handleEmailChange}
                  ref={this.emailRef}
                />
              </Col>
            </Form.Group>
            <ButtonGroup>
              <Button
                variant="primary"
                type="submit"
                disabled={!this.state.isReady}
              >
                Reset password
              </Button>
            </ButtonGroup>
          </Form>
        </>
      )
    }
    return (
      <Container>
        <Card className="border-0">
          <Card.Body className="p-3">
            <Card.Title>Password reset</Card.Title>
            {show}
          </Card.Body>
        </Card>
      </Container>
    )
  }
}

export function PasswordRecoverRequest() {
  const navigate = useNavigate()
  return <PasswordRecoverRequestImpl navigate={navigate} />
}
