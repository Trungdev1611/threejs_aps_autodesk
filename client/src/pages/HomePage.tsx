import { useEffect, useState } from 'react'
import { axiosClient } from '../api/axiosClient'

type Project = {
  id: string
  name: string
  phase: string
  bimStatus: string
}

export function HomePage() {
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await axiosClient.get<Project[]>('/api/projects')
        if (!cancelled) setProjects(data)
      } catch {
        if (!cancelled) {
          setError(
            'Không gọi được API. Chạy backend: cd server && dotnet run (port 5299), rồi npm run dev ở client.',
          )
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
      <p className="lede">
        Danh sách mock từ <code>.NET Web API</code> — minh họa lớp dashboard / chuyển đổi số.
      </p>
      {error && <p className="banner banner-warn">{error}</p>}
      {!error && projects === null && <p>Đang tải…</p>}
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
