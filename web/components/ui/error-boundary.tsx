'use client'

import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from './button'
import { Card } from './card'
import { Alert, AlertDescription } from './alert'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error; retry: () => void }>
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
    this.setState({
      error,
      errorInfo
    })
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback
        return <FallbackComponent error={this.state.error!} retry={this.handleRetry} />
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 flex items-center justify-center p-4">
          <Card className="bg-white/10 backdrop-blur-xl border-white/20 max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
              </div>
              
              <h2 className="text-2xl font-bold text-white text-center mb-4">
                Something went wrong
              </h2>
              
              <Alert className="bg-red-500/10 border-red-500/30 mb-4">
                <AlertCircle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-200">
                  An unexpected error occurred while loading the page. This might be due to a network issue or a temporary problem.
                </AlertDescription>
              </Alert>

              {this.state.error && (
                <div className="bg-black/20 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-300 font-mono break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Button 
                  onClick={this.handleRetry}
                  className="w-full bg-purple-500 hover:bg-purple-600"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/agents'}
                  className="w-full border-purple-500/50 text-purple-300 hover:bg-purple-500/10"
                >
                  Back to Agents
                </Button>
              </div>

              <p className="text-xs text-gray-400 text-center mt-4">
                If this problem persists, please check your network connection and try refreshing the page.
              </p>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

// Hook-based error boundary for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: React.ErrorInfo) => {
    console.error('[useErrorHandler] Error caught:', error, errorInfo)
    // You can also report to error tracking service here
  }
}