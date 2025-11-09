import React, { useState, useEffect } from 'react'
import { apiGet } from '../shared/api'

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [objects, setObjects] = useState<any[]>([])
  const [maxSize] = useState(1024 * 1024 * 1024) // 1 GB

  useEffect(() => {
    refreshList()
  }, [])

  async function refreshList() {
    const res = await apiGet('/api/r2/list')
    setObjects(res.objects || [])
  }

  async function upload() {
    if (!file) return alert('choose a file')
    if (file.size > maxSize) return alert('file exceeds max size (1GB)')
    // Request presigned PUT URL
    const params = new URLSearchParams({ filename: file.name, contentType: file.type })
    const r = await fetch(`/api/r2/presign?${params.toString()}`)
    const payload = await r.json()
    if (!payload?.url) return alert('presign failed: ' + JSON.stringify(payload))
    const presignedUrl = payload.url
    // Use XHR to track progress
    await putWithProgress(presignedUrl, file, (p) => setProgress(p))
    alert('Upload complete')
    setProgress(0)
    setFile(null)
    refreshList()
  }

  function putWithProgress(url: string, file: File, onProgress: (p: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', url, true)
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
      xhr.upload.onprogress = function(e) {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error('Upload failed: ' + xhr.statusText + ' ' + xhr.status))
      }
      xhr.onerror = function() { reject(new Error('XHR network error')) }
      xhr.send(file)
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-6">
        <header className="flex items-center gap-4 mb-4">
          <img src="/src/img/apple-logo.png" alt="logo" className="w-12 h-12 rounded-lg"/>
          <div>
            <h1 className="text-2xl font-semibold">Upload Files</h1>
            <p className="text-sm text-gray-500">Direct upload to R2 — supports up to 1GB</p>
          </div>
        </header>

        <div className="space-y-4">
          <input type="file" onChange={e => setFile(e.target?.files?.[0] ?? null)} />
          <div>
            <button onClick={upload} className="bg-black text-white px-4 py-2 rounded-md" disabled={!file}>
              Upload
            </button>
          </div>

          {progress > 0 && (
            <div className="w-full bg-gray-200 rounded">
              <div className="bg-black text-white rounded text-sm" style={{ width: `${progress}%` }}>
                {progress}%
              </div>
            </div>
          )}

          <section>
            <h2 className="text-lg font-medium mb-2">Uploaded files</h2>
            <ul className="space-y-2">
              {objects.map(o => (
                <li key={o.key} className="p-2 border rounded flex justify-between items-center">
                  <div>
                    <div className="font-medium">{o.key.split('/').pop()}</div>
                    <div className="text-sm text-gray-500">{(o.size / (1024*1024)).toFixed(2)} MB</div>
                  </div>
                  <div>
                    <a className="text-blue-600" href={`https://${location.hostname}/${o.key}`} target="_blank" rel="noreferrer">Open</a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
