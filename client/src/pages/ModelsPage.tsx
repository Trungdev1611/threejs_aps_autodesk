import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import { axiosClient } from '../api/axiosClient'
import { InlineApsViewer } from '../components/InlineApsViewer'

type StoredModel = {
  id: string
  fileName: string
  objectKey: string
  objectId: string
  urn: string
  status: string
  createdAt: string
  updatedAt: string
}

type UploadState = 'idle' | 'uploading' | 'uploaded' | 'translating' | 'error'

const ALLOWED_EXTENSIONS = ['.dwg', '.dxf', '.ifc', '.rvt', '.nwd', '.nwc', '.rte']
const ACCEPT_ATTR = ALLOWED_EXTENSIONS.join(',')

export function ModelsPage() {
  const [models, setModels] = useState<StoredModel[]>([])
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [message, setMessage] = useState<string>('Select a design file and click Upload.')
  const [activeUrn, setActiveUrn] = useState<string>('')
  const [viewUrn, setViewUrn] = useState<string>('')

  const isBusy = uploadState === 'uploading' || uploadState === 'translating'

  const canTranslate = useMemo(() => activeUrn.trim().length > 0, [activeUrn])

  async function loadModels() {
    try {
      const { data } = await axiosClient.get<StoredModel[]>('/api/models')
      setModels(data)
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data) {
        const payload = e.response.data as { error?: string }
        setMessage(payload.error ?? 'Failed to load model list.')
      } else {
        setMessage('Failed to load model list.')
      }
    }
  }

  useEffect(() => {
    // Initial data fetch on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadModels()
  }, [])

  async function onUpload() {
    if (!selectedFile) return
    const lowerName = selectedFile.name.toLowerCase()
    const ok = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
    if (!ok) {
      setUploadState('error')
      setMessage(`Allowed extensions: ${ALLOWED_EXTENSIONS.join(', ')}.`)
      return
    }
    const form = new FormData()
    form.append('file', selectedFile)

    setUploadState('uploading')
    setMessage('Uploading to APS storage...')
    try {
      const { data } = await axiosClient.post<StoredModel>('/api/models/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setActiveUrn(data.urn)
      setUploadState('uploaded')
      setMessage(`Uploaded: ${data.fileName}. URN created, you can run Translate.`)
      await loadModels()
    } catch (e) {
      setUploadState('error')
      if (axios.isAxiosError(e) && e.response?.data) {
        const payload = e.response.data as { error?: string }
        setMessage(payload.error ?? `Upload failed (HTTP ${e.response.status}).`)
      } else {
        setMessage('Upload failed.')
      }
    }
  }

  async function pollStatus(urn: string, attempt = 0) {
    const maxAttempts = 100
    const intervalMs = 3000

    try {
      const { data } = await axiosClient.get<{ status?: string }>('/api/models/' + encodeURIComponent(urn) + '/status')
      const status = data.status ?? 'unknown'
      setMessage(`Translate status: ${status}`)
      await loadModels()

      if (status === 'success') {
        setUploadState('uploaded')
        return
      }
      if (status === 'failed') {
        setUploadState('error')
        return
      }
      if (attempt >= maxAttempts) {
        setUploadState('error')
        setMessage('Translation timeout. Please check status again later.')
        return
      }

      window.setTimeout(() => {
        void pollStatus(urn, attempt + 1)
      }, intervalMs)
    } catch {
      setUploadState('error')
      setMessage('Status polling failed.')
    }
  }

  async function onTranslate() {
    if (!canTranslate || isBusy) return
    setUploadState('translating')
    setMessage('Translation job started. Polling status…')
    try {
      await axiosClient.post('/api/models/' + encodeURIComponent(activeUrn) + '/translate')
      await pollStatus(activeUrn)
    } catch (e) {
      setUploadState('error')
      if (axios.isAxiosError(e) && e.response?.data) {
        const payload = e.response.data as { error?: string }
        setMessage(payload.error ?? `Translate failed (HTTP ${e.response.status}).`)
      } else {
        setMessage('Translate failed.')
      }
    }
  }

  return (
    <div className="page">
      <h1>APS Models</h1>
      <p className="lede">
        Backend workflow: <code>upload</code> {'->'} <code>URN</code> {'->'} <code>translate</code> {'->'}{' '}
        <code>status</code> {'->'} view in the browser.
      </p>

      <div className="banner">
        <input
          type="file"
          accept={ACCEPT_ATTR}
          onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
          disabled={isBusy}
        />
        <div className="models-actions">
          <button onClick={() => void onUpload()} disabled={!selectedFile || isBusy}>
            Upload
          </button>
          <button onClick={() => void onTranslate()} disabled={!canTranslate || isBusy}>
            Translate
          </button>
          <button
            onClick={() => setViewUrn(activeUrn)}
            disabled={!activeUrn}
            className="viewer-link"
          >
            Viewer
          </button>
          {activeUrn && (
            <a
              className="viewer-link"
              href={`/aps?urn=${encodeURIComponent(activeUrn)}`}
              target="_blank"
              rel="noreferrer"
            >
              Viewer (new tab)
            </a>
          )}
          {viewUrn && (
            <button onClick={() => setViewUrn('')} className="viewer-link">
              Close viewer
            </button>
          )}
        </div>
        <p className="status-line">{message}</p>
        {activeUrn && (
          <p className="status-line">
            URN hiện tại: <code>{activeUrn}</code>
          </p>
        )}
      </div>

      {viewUrn && <InlineApsViewer urn={viewUrn} />}

      <table className="table">
        <thead>
          <tr>
            <th>File</th>
            <th>Status</th>
            <th>URN</th>
            <th>Open</th>
          </tr>
        </thead>
        <tbody>
          {models.map((m) => (
            <tr key={m.id}>
              <td>{m.fileName}</td>
              <td>{m.status}</td>
              <td>
                <code>{m.urn.slice(0, 28)}...</code>
              </td>
              <td>
                <button
                  className="linklike"
                  onClick={() => setViewUrn(m.urn)}
                  disabled={m.status !== 'success'}
                >
                  Viewer
                </button>{' '}
                <a
                  href={`/aps?urn=${encodeURIComponent(m.urn)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  (new tab)
                </a>
              </td>
            </tr>
          ))}
          {models.length === 0 && (
            <tr>
              <td colSpan={4}>No models found in the database.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
