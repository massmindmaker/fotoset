"use client"

import React, { Component, type ErrorInfo, type ReactNode } from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })

    // Log error to console in development
    console.error("ErrorBoundary caught an error:", error)
    console.error("Component stack:", errorInfo.componentStack)

    // In production, you could send to error tracking service
    if (process.env.NODE_ENV === "production") {
      // Example: sendToErrorTracking(error, errorInfo)
    }
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-destructive/10 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Что-то пошло не так
              </h2>
              <p className="text-muted-foreground text-sm">
                Произошла непредвиденная ошибка. Попробуйте обновить страницу или нажмите кнопку ниже.
              </p>
            </div>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="text-left bg-muted/50 rounded-lg p-3 text-xs">
                <summary className="cursor-pointer text-muted-foreground font-medium">
                  Детали ошибки (dev only)
                </summary>
                <pre className="mt-2 overflow-auto text-destructive whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Попробовать снова
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-muted text-foreground rounded-xl font-medium hover:bg-muted/80 transition-colors"
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
