import { Component } from 'react'

// Without this, any unhandled render error anywhere in the tree white-screens
// the entire app with no recovery path. React only supports error boundaries
// as class components — there's no hooks equivalent.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: '#0b0f12',
            color: '#e8f1f4',
            padding: 24,
            textAlign: 'center',
            fontFamily: 'Manrope, sans-serif',
          }}
        >
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: '1.4rem', marginBottom: 12 }}>Something went wrong</h1>
            <p style={{ color: 'rgba(232, 241, 244, 0.72)', marginBottom: 24, lineHeight: 1.6 }}>
              This page hit an unexpected error. Reloading usually fixes it — your work is
              auto-saved.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 22px',
                borderRadius: 999,
                border: 'none',
                background: 'linear-gradient(135deg, #7ef7ff, #62ffa2)',
                color: '#0b0f12',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
