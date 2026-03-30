import { Link, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          BIM portal <span className="brand-muted">sample</span>
        </Link>
        <nav className="nav">
          <Link to="/">Projects</Link>
          <Link to="/three">Three.js</Link>
          <Link to="/aps">APS viewer</Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
