import axios from 'axios'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { axiosClient } from '../api/axiosClient'

type Project = {
  id: string
  name: string
  phase: string
  bimStatus: string
}

export function HomePage() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [health, setHealth] = useState<{ ok: boolean; dbReady?: boolean } | null>(null)
  const [apsConfig, setApsConfig] = useState<{
    isConfigured?: boolean
    dbReady?: boolean
    bucketKey?: string
    bucketPolicy?: string
  } | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await axiosClient.get<Project[]>('/api/projects')
        if (!cancelled) setProjects(data)
      } catch {
        if (!cancelled) {
          setProjectsError('Failed to load Projects. Please check the backend.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [h, c] = await Promise.all([
          axiosClient.get<{ ok: boolean; dbReady?: boolean }>('/api/health'),
          axiosClient.get<{
            isConfigured?: boolean
            dbReady?: boolean
            bucketKey?: string
            bucketPolicy?: string
          }>('/api/aps/config'),
        ])
        if (!cancelled) {
          setHealth(h.data)
          setApsConfig(c.data)
        }
      } catch (e) {
        if (!cancelled) {
          if (axios.isAxiosError(e) && e.response?.data) {
            const payload = e.response.data as { error?: string }
            setSetupError(payload.error ?? 'Failed to fetch system status.')
          } else {
            setSetupError('Failed to fetch system status.')
          }
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page">
      <h1>Projects</h1>

      <div className="home-grid">
        <section className="card">
          <h2>Quick start</h2>
          <ol className="steps">
            <li>
              Open <Link to="/models">APS models</Link> to <strong>Upload</strong> a design file.
            </li>
            <li>
              Click <strong>Translate</strong> and wait for <code>success</code>.
            </li>
            <li>
              Open the <strong>Viewer</strong> to inspect the model in the browser.
            </li>
          </ol>
          <p className="muted">
            If you do not have an APS app yet, create one to get <code>ClientId/ClientSecret</code> and configure the backend.
          </p>
        </section>

        <section className="card">
          <h2>System status</h2>
          {setupError && <p className="banner banner-warn">{setupError}</p>}
          {!setupError && (
            <dl className="kv">
              <div>
                <dt>API</dt>
                <dd>{health ? (health.ok ? 'OK' : 'Down') : 'Checking…'}</dd>
              </div>
              <div>
                <dt>PostgreSQL</dt>
                <dd>
                  {apsConfig?.dbReady ?? health?.dbReady
                    ? 'Ready'
                    : 'Not ready (set ConnectionStrings:Default)'}
                </dd>
              </div>
              <div>
                <dt>APS config</dt>
                <dd>{apsConfig?.isConfigured ? 'Configured' : 'Missing ClientId/Secret'}</dd>
              </div>
              <div>
                <dt>Bucket</dt>
                <dd>
                  {apsConfig?.bucketKey ? (
                    <>
                      <code>{apsConfig.bucketKey}</code> ({apsConfig.bucketPolicy ?? '—'})
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
          )}
        </section>
      </div>

      {projectsError && <p className="banner banner-warn">{projectsError}</p>}
      {!projectsError && projects === null && <p>Loading…</p>}
      {projects && (
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Phase</th>
              <th>BIM</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.phase}</td>
                <td>{p.bimStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
