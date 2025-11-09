// worker/index.ts
import { Router } from 'itty-router'
import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler'

// Types for Env bindings
export interface Env {
  // Workers Sites KV binding (auto-created when using [site] in wrangler.toml)
  ASSETS: KVNamespace

  // D1 database binding
  employee_db?: D1Database

  // R2 bucket binding
  BUCKET?: R2Bucket

  // (Secrets set via wrangler secret put)
  R2_ACCESS_KEY?: string
  R2_SECRET_KEY?: string
  R2_ACCOUNT_ID?: string
}

// Create router
const router = Router()

/* -------------------------
   API: Employees (D1)
   POST /api/employees  -> create
   GET  /api/employees  -> list
   ------------------------- */
router.post('/api/employees', async (request: Request, env: Env) => {
  const body = await safeJson(request)
  if (!body?.nirc || !body?.full_name || !body?.email) {
    return jsonResponse({ error: 'nirc, full_name and email required' }, 400)
  }
  const nirc = String(body.nirc)
  const full_name = String(body.full_name)
  const position = body.position ? String(body.position) : ''
  const email = String(body.email)

  if (!env.employee_db) return jsonResponse({ error: 'D1 binding not configured' }, 500)

  try {
    const res = await env.employee_db.prepare(
      `INSERT INTO employees (nirc, full_name, position, email) VALUES (?, ?, ?, ?)`
    ).bind(nirc, full_name, position, email).run()
    return jsonResponse({ success: true, id: res.lastInsertRowid }, 201)
  } catch (err: any) {
    // Return DB error text (useful in dev)
    return jsonResponse({ error: err?.message ?? String(err) }, 500)
  }
})

router.get('/api/employees', async (_req: Request, env: Env) => {
  if (!env.employee_db) return jsonResponse({ error: 'D1 binding not configured' }, 500)
  try {
    const rows = await env.employee_db.prepare('SELECT * FROM employees ORDER BY created_at DESC').all()
    return jsonResponse({ results: rows.results || [] })
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? String(err) }, 500)
  }
})

/* -------------------------
   API: R2 listing
   GET /api/r2/list  -> list objects under uploads/
   ------------------------- */
router.get('/api/r2/list', async (_req: Request, env: Env) => {
  if (!env.BUCKET) return jsonResponse({ error: 'R2 binding not configured' }, 500)
  try {
    // list() method on R2Bucket
    const listRes = await env.BUCKET.list?.({ prefix: 'uploads/' })
    const objects = (listRes?.objects || []).map((o: any) => ({
      key: o.key,
      size: o.size,
      uploaded: o.uploaded,
      httpEtag: o.httpEtag
    }))
    return jsonResponse({ objects })
  } catch (err: any) {
    return jsonResponse({ error: err?.message ?? String(err) }, 500)
  }
})

/* -------------------------
   Debug: show environment binding names
   GET /_debug/env
   ------------------------- */
router.get('/_debug/env', async (_req: Request, env: Env) => {
  // Only in dev — in production be careful exposing env keys
  const keys = Object.keys(env || {}).sort()
  return jsonResponse({ env: keys })
})

/* -------------------------
   Static asset handler (kv-asset-handler)
   - Serves /, /employee, /upload as their HTML assets if present
   - Serves built assets (js/css/images) from the Workers Sites KV binding (ASSETS)
   ------------------------- */
router.get('*', async (request: Request, env: Env) => {
  // Map friendly paths to actual asset names (so /employee -> /employee.html)
  const url = new URL(request.url)
  const pathname = url.pathname

  // Accept both / and /index.html
  if (pathname === '/' || pathname === '/employee') {
    // Serve /employee.html if present
    const r = new Request(new URL('/employee.html', request.url).toString(), request)
    return serveAsset(r, env)
  }
  if (pathname === '/upload') {
    const r = new Request(new URL('/upload.html', request.url).toString(), request)
    return serveAsset(r, env)
  }

  // For everything else, try to serve from ASSETS (allow fallback to index.html if SPA)
  return serveAsset(request, env)
})

/* -------------------------
   Export default (Module Worker)
   ------------------------- */
export default {
  async fetch(request: Request, env: Env, ctx: any) {
    try {
      // Route request via itty-router
      return await router.handle(request, env)
    } catch (err: any) {
      // Log and return a helpful error response (remove stack details in production)
      console.error('Unhandled worker error:', err?.stack ?? err?.message ?? String(err))
      return jsonResponse({
        error: 'Worker runtime exception',
        message: err?.message ?? String(err),
        stack: (err?.stack ?? '').split('\n').slice(0, 10)
      }, 500)
    }
  }
}

/* -------------------------
   Helper functions
   ------------------------- */

async function serveAsset(request: Request, env: Env) {
  // Ensure ASSETS exists
  if (!env.ASSETS) {
    return new Response('Asset binding (ASSETS) not configured. Ensure [site] in wrangler.toml.', { status: 500 })
  }

  try {
    // mapRequestToAsset helps resolve index.html etc.
    const options = {
      // mapRequestToAsset gives the correct asset key for a request
      mapRequestToAsset: (req: Request) => mapRequestToAsset(req)
      // You can add cacheControl, onNotFound handlers, etc.
    }
    const assetResponse = await getAssetFromKV({ request, waitUntil: (p: Promise<any>) => p }, { ASSETS: env.ASSETS, mapRequestToAsset: mapRequestToAsset })
    return assetResponse
  } catch (err: any) {
    // If asset isn't found, optionally serve index.html for SPA routing
    // Try to return employee.html for fallback (optional)
    try {
      const fallback = new Request(new URL('/employee.html', request.url).toString(), request)
      const fallbackResponse = await getAssetFromKV({ request: fallback }, { ASSETS: env.ASSETS, mapRequestToAsset: mapRequestToAsset })
      return fallbackResponse
    } catch (innerErr) {
      console.error('Asset serve error:', err, innerErr)
      return new Response('Not Found', { status: 404 })
    }
  }
}

async function safeJson(req: Request) {
  try {
    return await req.json()
  } catch {
    return null
  }
}

function jsonResponse(obj: any, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
