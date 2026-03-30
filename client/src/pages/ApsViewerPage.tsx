import axios from 'axios'
import { useEffect, useRef, useState } from 'react'
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

type TokenResponse = { access_token?: string; error?: string; reason?: string }

export function ApsViewerPage() {
  const hostRef = useRef<HTMLDivElement>(null)
  const urn = import.meta.env.VITE_APS_URN?.trim() ?? ''
  const [status, setStatus] = useState<string>(
    urn
      ? 'Chuẩn bị…'
      : 'Chưa có URN: tạo file .env với VITE_APS_URN=... (xem .env.example) sau khi model đã translate trên APS.',
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host || !urn) return

    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let viewer: any = null

    ;(async () => {
      try {
        setStatus('Đang lấy token từ /api/aps/token…')
        let tokenJson: TokenResponse
        try {
          const { data } = await axiosClient.get<TokenResponse>('/api/aps/token')
          tokenJson = data
        } catch (e) {
          if (cancelled) return
          if (axios.isAxiosError(e) && e.response?.data) {
            const d = e.response.data as TokenResponse
            setStatus(
              d.error ??
                d.reason ??
                `Token lỗi HTTP ${e.response.status}. Cấu hình Aps:ClientId/Secret trên server.`,
            )
          } else {
            setStatus(e instanceof Error ? e.message : String(e))
          }
          return
        }
        const token = tokenJson.access_token
        if (!token) {
          setStatus(
            tokenJson.error ?? tokenJson.reason ?? 'Phản hồi token không có access_token.',
          )
          return
        }

        if (cancelled) return
        setStatus('Đang tải Autodesk Viewer SDK…')
        await loadStylesheet(`${VIEWER_BASE}/style.min.css`)
        await loadScript(`${VIEWER_BASE}/viewer3D.min.js`)
        if (cancelled) return

        await new Promise<void>((resolve, reject) => {
          try {
            Autodesk.Viewing.Initializer(
              { env: 'AutodeskProduction2', api: 'streamingV2', accessToken: token },
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
        setStatus('Đang load document…')

        Autodesk.Viewing.Document.load(
          urn,
          (doc: unknown) => {
            if (cancelled) return
            const root = (doc as { getRoot(): { getDefaultGeometry(): unknown } }).getRoot()
            const viewable = root.getDefaultGeometry()
            void viewer.loadDocumentNode(doc, viewable)
            setStatus('Đã load model (nếu URN hợp lệ).')
          },
          (code: number, msg: string) => {
            if (!cancelled) setStatus(`Document.load lỗi: ${code} — ${msg}`)
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
  }, [urn])

  return (
    <div className="page page-fill">
      <h1>Autodesk APS Viewer</h1>
      <p className="lede">
        Token OAuth 2-legged lấy từ <code>.NET</code> (<code>/api/aps/token</code>). URN từ{' '}
        <code>VITE_APS_URN</code>.
      </p>
      <p className="status-line">{status}</p>
      <div ref={hostRef} className="viewer-host" />
    </div>
  )
}
