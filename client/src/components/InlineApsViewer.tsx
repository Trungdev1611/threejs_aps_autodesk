import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
import { axiosClient } from '../api/axiosClient'

/** Phiên bản Viewer — nếu 404, đổi theo doc APS hiện tại. */
const VIEWER_VERSION = '7.111.1'
const VIEWER_BASE = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${VIEWER_VERSION}`

let viewerAssetsPromise: Promise<void> | null = null

function loadViewerAssets(): Promise<void> {
  if (viewerAssetsPromise) return viewerAssetsPromise
  viewerAssetsPromise = (async () => {
    await new Promise<void>((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = `${VIEWER_BASE}/style.min.css`
      link.onload = () => resolve()
      link.onerror = () => reject(new Error('Failed to load Viewer CSS'))
      document.head.appendChild(link)
    })
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script')
      s.src = `${VIEWER_BASE}/viewer3D.min.js`
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => reject(new Error('Failed to load Viewer JS'))
      document.body.appendChild(s)
    })
  })()
  return viewerAssetsPromise
}

type TokenResponse = { access_token?: string; expires_in?: number; error?: string; reason?: string }

function normalizeDocumentId(input: string): string {
  const v = input.trim()
  if (!v) return ''
  return v.startsWith('urn:') ? v : `urn:${v}`
}

export function InlineApsViewer({ urn }: { urn: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const documentId = normalizeDocumentId(urn)
  const [status, setStatus] = useState<string>(documentId ? 'Ready' : 'Missing URN.')

  useEffect(() => {
    const host = hostRef.current
    if (!host || !documentId) return

    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null

    ;(async () => {
      try {
        setStatus('Loading Viewer SDK…')
        await loadViewerAssets()
        if (cancelled) return

        const getAccessToken = async (onTokenReady: (token: string, expiresIn: number) => void) => {
          try {
            const { data } = await axiosClient.get<TokenResponse>('/api/aps/token')
            const token = data.access_token
            const expiresIn = (data as unknown as { expires_in?: number }).expires_in ?? 3000
            if (!token) throw new Error(data.error ?? data.reason ?? 'Missing access_token')
            onTokenReady(token, expiresIn)
          } catch (e) {
            if (!cancelled) {
              if (axios.isAxiosError(e) && e.response?.data) {
                const d = e.response.data as TokenResponse
                setStatus(d.error ?? d.reason ?? `Token error (HTTP ${e.response.status}).`)
              } else {
                setStatus(e instanceof Error ? e.message : String(e))
              }
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
      }
      host.innerHTML = ''
    }
  }, [documentId])

  return (
    <div className="inline-viewer">
      <div className="inline-viewer-bar">
        <div className="inline-viewer-title">
          Viewer <span className="muted">(URN: {urn.slice(0, 24)}…)</span>
        </div>
        <div className="inline-viewer-status">{status}</div>
      </div>
      <div ref={hostRef} className="viewer-host" />
    </div>
  )
}

