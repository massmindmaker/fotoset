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

// Debug panel - client-only with suppressHydrationWarning
function DebugPanel() {
  return (
    <div 
      id="debug-panel"
      suppressHydrationWarning
      style={{
        position: 'fixed',
        top: 30,
        left: 0,
        right: 0,
        background: '#333',
        color: '#0f0',
        padding: '6px',
        fontSize: '11px',
        fontFamily: 'monospace',
        zIndex: 99998,
      }}
    >
      checking...
    </div>
  )
}

// Script to update debug panel after hydration
const debugScript = `
  (function() {
    var tick = 0;
    function update() {
      var panel = document.getElementById('debug-panel');
      if (!panel) return;
      
      var tg = window.Telegram && window.Telegram.WebApp;
      var hasSpinner = !!document.querySelector('.animate-spin');
      var hasError = !!document.querySelector('[style*="ffcccc"]');
      var mainContent = document.querySelector('.min-h-screen');
      var childCount = mainContent ? mainContent.children.length : 0;
      
      panel.textContent = 't:' + tick + 
        ' | tg:' + (tg ? 'yes' : 'no') + 
        ' | user:' + (tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id : 'none') +
        ' | spin:' + (hasSpinner ? 'yes' : 'no') +
        ' | err:' + (hasError ? 'yes' : 'no') +
        ' | kids:' + childCount;
      tick++;
    }
    
    update();
    setInterval(update, 1000);
  })();
`

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
        DEBUG v2
      </div>
      <DebugPanel />
      <script dangerouslySetInnerHTML={{ __html: debugScript }} />
      <DebugErrorBoundary>
        <PersonaApp />
      </DebugErrorBoundary>
    </>
  )
}
