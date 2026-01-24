import PersonaApp from "@/components/persona-app"

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
      <PersonaApp />
    </>
  )
}
