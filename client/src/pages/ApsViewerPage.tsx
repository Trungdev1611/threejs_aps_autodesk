import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { axiosClient } from '../api/axiosClient'

/** Phiên bản Viewer — nếu 404, đổi theo doc APS hiện tại. */
const VIEWER_VERSION = '7.111.1'
const VIEWER_BASE = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}`

function loadStylesheet(href: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.onload = () => resolve()
    link.onerror = () => reject(new Error(`CSS: ${href}`))
    document.head.appendChild(link)
  })
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Script: ${src}`))
    document.body.appendChild(s)
  })
}

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; reason?: string }

type StoredModel = { id: string; fileName: string; urn: string; status: string }

function normalizeDocumentId(input: string): string {
  const v = input.trim()
  if (!v) return ''
  return v.startsWith('urn:') ? v : `urn:${v}`
}

export function ApsViewerPage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const urnFromQuery = searchParams.get('urn')?.trim() ?? ''
  const [urnInput, setUrnInput] = useState<string>(urnFromQuery || import.meta.env.VITE_APS_URN?.trim() || '')
  const [recent, setRecent] = useState<StoredModel[]>([])
  const urn = urnFromQuery || urnInput.trim()
  const documentId = normalizeDocumentId(urn)
  const [status, setStatus] = useState<string>(
    documentId
      ? 'Ready'
      : 'Missing URN. Open a model from the Models page, or paste a URN here.',
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await axiosClient.get<StoredModel[]>('/api/models')
        if (!cancelled) setRecent(data.slice(0, 10))
      } catch {
        // ignore - viewer can still work with manual URN
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !documentId) return

    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null

    ;(async () => {
      try {
        setStatus('Loading Autodesk Viewer SDK…')
        await loadStylesheet(`${VIEWER_BASE}/style.min.css`)
        await loadScript(`${VIEWER_BASE}/viewer3D.min.js`)
        if (cancelled) return

        const getAccessToken = async (onTokenReady: (token: string, expiresIn: number) => void) => {
          try {
            const { data } = await axiosClient.get<TokenResponse>('/api/aps/token')
            const token = data.access_token
            const expiresIn = (data as unknown as { expires_in?: number }).expires_in ?? 3000
            if (!token) throw new Error(data.error ?? data.reason ?? 'Missing access_token')
            onTokenReady(token, expiresIn)
          } catch (e) {
            if (cancelled) return
            if (axios.isAxiosError(e) && e.response?.data) {
              const d = e.response.data as TokenResponse
              setStatus(
                d.error ??
                  d.reason ??
                  `Token error (HTTP ${e.response.status}). Check APS ClientId/Secret.`,
              )
            } else {
              setStatus(e instanceof Error ? e.message : String(e))
            }
          }
        }

        await new Promise<void>((resolve, reject) => {
          try {
            Autodesk.Viewing.Initializer(
              { env: 'AutodeskProduction2', api: 'streamingV2', getAccessToken },
              () => resolve(),
              (err: unknown) => reject(err instanceof Error ? err : new Error(String(err))),
            )
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)))
          }
        })
        if (cancelled) return

        viewer = new Autodesk.Viewing.GuiViewer3D(host, { extensions: [] })
        viewer.start()
        setStatus('Loading document…')

        Autodesk.Viewing.Document.load(
          documentId,
          (doc: unknown) => {
            if (cancelled) return
            const root = (doc as { getRoot(): { getDefaultGeometry(): unknown } }).getRoot()
            const viewable = root.getDefaultGeometry()
            void viewer.loadDocumentNode(doc, viewable)
            setStatus('OK')
          },
          (code: number, msg: string) => {
            if (!cancelled) setStatus(`Document.load error: ${code} — ${msg}`)
          },
        )
      } catch (e) {
        if (!cancelled) setStatus(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
      if (viewer && typeof viewer.finish === 'function') {
        try {
          viewer.finish()
        } catch {
          /* ignore */
        }
        viewer = null
      }
      host.innerHTML = ''
    }
  }, [documentId])

  return (
    <div className="page page-fill">
      <h1>Autodesk Viewer</h1>
      <div className="viewer-controls">
        <input
          className="viewer-input"
          value={urnInput}
          onChange={(e) => setUrnInput(e.target.value)}
          placeholder="Paste URN base64url hoặc urn:..."
        />
        <button
          className="viewer-button"
          onClick={() => {
            const v = urnInput.trim()
            setSearchParams(v ? { urn: v } : {})
          }}
        >
          Open
        </button>
        <button
          className="viewer-button"
          onClick={() => {
            setUrnInput('')
            setSearchParams({})
          }}
        >
          Clear
        </button>
      </div>
      {recent.length > 0 && (
        <div className="viewer-recent">
          <div className="viewer-recent-title">Recent models</div>
          <ul>
            {recent.map((m) => (
              <li key={m.id}>
                <button
                  className="viewer-recent-item"
                  onClick={() => {
                    setUrnInput(m.urn)
                    setSearchParams({ urn: m.urn })
                  }}
                >
                  {m.fileName} <span className="muted">({m.status})</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="status-line">{status}</p>
      <div ref={hostRef} className="viewer-host" />
    </div>
  )
}
