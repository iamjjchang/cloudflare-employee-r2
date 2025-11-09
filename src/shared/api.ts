// src/shared/api.ts
export async function apiGet<T = any>(path: string): Promise<T | null> {
  const res = await fetch(path, { credentials: 'same-origin' })
  if (!res.ok) {
    // return null for non-200; caller should handle it
    console.warn(`apiGet ${path} returned ${res.status} ${res.statusText}`)
    return null
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    // not JSON — return null
    return null
  }
  try {
    return await res.json() as T
  } catch (err) {
    console.warn('apiGet parse error', err)
    return null
  }
}

export async function apiPost<T = any>(path: string, body?: any): Promise<T | null> {
  const res = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    console.warn(`apiPost ${path} returned ${res.status} ${res.statusText}`)
    return null
  }
  const contentType = res.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) return null
  try {
    return await res.json() as T
  } catch (err) {
    console.warn('apiPost parse error', err)
    return null
  }
}
