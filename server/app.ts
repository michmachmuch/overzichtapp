import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import type { Service } from './service.ts'
import { isLocalData, type Store } from './store.ts'
import { GitLabError } from './gitlab.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2',
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const c of req) {
    size += (c as Buffer).length
    if (size > 2_000_000) throw new Error('Body too large')
    chunks.push(c as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function createApp(service: Service, store: Store, staticDir: string | null) {
  return createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    try {
      if (path.startsWith('/api/')) {
        if (req.method === 'GET' && path === '/api/status') return send(res, 200, await service.status())

        if (req.method === 'GET' && path === '/api/time') {
          const from = url.searchParams.get('from') ?? ''
          const to = url.searchParams.get('to') ?? ''
          if (!DATE.test(from) || !DATE.test(to) || from > to) return send(res, 400, { error: 'from/to moeten YYYY-MM-DD zijn' })
          const entries = await service.timeEntries(from, to)
          console.log(`[tijd] ${from} t/m ${to}: ${entries.length} registraties, ${entries.filter((e) => e.mine).length} van jou`)
          return send(res, 200, entries)
        }

        if (req.method === 'GET' && path === '/api/time/diagnose') {
          const from = url.searchParams.get('from') ?? ''
          const to = url.searchParams.get('to') ?? ''
          if (!DATE.test(from) || !DATE.test(to) || from > to) return send(res, 400, { error: 'from/to moeten YYYY-MM-DD zijn' })
          return send(res, 200, await service.diagnoseTime(from, to))
        }

        if (req.method === 'GET' && path === '/api/issues') return send(res, 200, await service.myIssues())
        if (req.method === 'GET' && path === '/api/merge-requests') return send(res, 200, await service.mergeRequests())

        if (req.method === 'GET' && path === '/api/checkins') {
          const data = await store.read()
          return send(res, 200, await Promise.all(data.checkins.map((c) => service.checkinStatus(c))))
        }

        const checked = path.match(/^\/api\/checkins\/([^/]+)\/checked$/)
        if (req.method === 'POST' && checked) {
          const data = await store.read()
          const c = data.checkins.find((x) => x.id === checked[1])
          if (!c) return send(res, 404, { error: 'Onbekende check-in' })
          const next = { ...data, checkins: data.checkins.map((x) => (x.id === c.id ? { ...x, lastCheckedAt: new Date().toISOString() } : x)) }
          await store.write(next)
          return send(res, 200, next)
        }

        if (req.method === 'GET' && path === '/api/data') return send(res, 200, await store.read())
        if (req.method === 'PUT' && path === '/api/data') {
          const body = await readBody(req)
          if (!isLocalData(body)) return send(res, 400, { error: 'Ongeldige data' })
          await store.write(body)
          return send(res, 200, body)
        }
        return send(res, 404, { error: 'Niet gevonden' })
      }

      if (!staticDir || (req.method !== 'GET' && req.method !== 'HEAD')) return send(res, 404, { error: 'Niet gevonden' })
      // Static files of the built web app, with fallback to index.html.
      const safe = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, '')
      let file = join(staticDir, safe)
      if (!file.startsWith(staticDir)) return send(res, 403, { error: 'Verboden' })
      try {
        if (!(await stat(file)).isFile()) throw new Error('dir')
      } catch {
        file = join(staticDir, 'index.html')
      }
      const body = await readFile(file)
      res.writeHead(200, {
        'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
        'Cache-Control': file.includes('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    } catch (e) {
      const status = e instanceof GitLabError ? 502 : 500
      console.error(`[fout] ${req.method} ${path}: ${(e as Error).message}`)
      send(res, status, { error: (e as Error).message })
    }
  })
}
