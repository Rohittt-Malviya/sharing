import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="card max-w-md w-full flex flex-col items-center gap-6">
            <span className="text-6xl">💥</span>
            <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
            <p className="text-slate-400 text-center text-sm">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              className="btn-primary w-full"
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/'
              }}
            >
              Go Home
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
