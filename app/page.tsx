"use client"

import { Component, ReactNode, useState, useEffect } from "react"
import PersonaApp from "@/components/persona-app"

// Temporary debug error boundary - shows errors on screen
class DebugErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; errorInfo: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null, errorInfo: "" }
  }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo: errorInfo.componentStack || "" })
    console.error("DebugErrorBoundary caught:", error, errorInfo)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 20,
          margin: 60,
          background: '#ffcccc',
          color: '#cc0000',
          borderRadius: 8,
          fontFamily: 'monospace'
        }}>
          <h2 style={{ margin: '0 0 10px 0' }}>ERROR CAUGHT:</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14, margin: '0 0 10px 0' }}>
            {this.state.error.toString()}
          </pre>
          <details>
            <summary style={{ cursor: 'pointer', marginBottom: 10 }}>Stack trace</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
              {this.state.error.stack}
            </pre>
          </details>
          {this.state.errorInfo && (
            <details>
              <summary style={{ cursor: 'pointer', marginBottom: 10 }}>Component stack</summary>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>
                {this.state.errorInfo}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

// Debug panel to show Telegram SDK and auth state
function DebugPanel() {
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown>>({})
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const update = () => {
      const tg = (window as any).Telegram?.WebApp
      setDebugInfo({
        hasTelegram: !!(window as any).Telegram,
        hasWebApp: !!tg,
        initDataLength: tg?.initData?.length || 0,
        hasUser: !!tg?.initDataUnsafe?.user,
        userId: tg?.initDataUnsafe?.user?.id || 'none',
        platform: tg?.platform || 'unknown',
        version: tg?.version || 'unknown',
        colorScheme: tg?.colorScheme || 'unknown',
        isExpanded: tg?.isExpanded || false,
        viewportHeight: tg?.viewportHeight || 0,
      })
    }
    
    update()
    const interval = setInterval(() => {
      update()
      setTick(t => t + 1)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 30,
      left: 0,
      right: 0,
      background: '#333',
      color: '#0f0',
      padding: '8px',
      fontSize: '10px',
      fontFamily: 'monospace',
      zIndex: 99998,
      maxHeight: '150px',
      overflow: 'auto'
    }}>
      <div>Tick: {tick} | {new Date().toISOString().slice(11, 19)}</div>
      {Object.entries(debugInfo).map(([key, value]) => (
        <div key={key}>{key}: {String(value)}</div>
      ))}
    </div>
  )
}

export default function Home() {
  return (
    <>
      <div id="debug-marker" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#ffcc00',
        color: '#000',
        padding: '8px',
        textAlign: 'center',
        fontSize: '12px',
        zIndex: 99999
      }}>
        DEBUG: Page loaded - {new Date().toISOString().slice(0, 19)}
      </div>
      <DebugPanel />
      <DebugErrorBoundary>
        <PersonaApp />
      </DebugErrorBoundary>
    </>
  )
}
