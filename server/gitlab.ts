/**
 * Minimal GitLab API client.
 *
 * READ-ONLY BY DESIGN: this client can only send GET requests. There is no
 * code path that writes to GitLab (no POST/PUT/PATCH/DELETE), so the app can
 * never push or change anything in the team repository.
 */

export type FetchLike = (url: string, init: { method: 'GET'; headers: Record<string, string> }) => Promise<{
  ok: boolean
  status: number
  headers: { get(name: string): string | null }
  json(): Promise<unknown>
  text(): Promise<string>
}>

export class GitLabError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export class GitLabClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly fetchFn: FetchLike

  constructor(baseUrl: string, token: string, fetchFn: FetchLike = fetch as unknown as FetchLike) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.token = token
    this.fetchFn = fetchFn
  }

  private url(path: string, query: Record<string, string | number | boolean | undefined> = {}) {
    const u = new URL(this.baseUrl + '/api/v4' + path)
    for (const [k, v] of Object.entries(query)) if (v !== undefined) u.searchParams.set(k, String(v))
    return u.toString()
  }

  private async request(path: string, query?: Record<string, string | number | boolean | undefined>) {
    const res = await this.fetchFn(this.url(path, query), {
      method: 'GET',
      headers: { 'PRIVATE-TOKEN': this.token, Accept: 'application/json' },
    })
    if (!res.ok) {
      const hint = res.status === 401 ? 'token ongeldig of verlopen' : res.status === 403 ? 'geen toegang' : res.status === 404 ? 'niet gevonden' : 'fout'
      throw new GitLabError(res.status, `GitLab ${res.status} (${hint}) bij ${path}`)
    }
    return res
  }

  async get<T>(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<T> {
    return (await (await this.request(path, query)).json()) as T
  }

  async getText(path: string, query?: Record<string, string | number | boolean | undefined>): Promise<string> {
    return (await this.request(path, query)).text()
  }

  /** Follows GitLab's x-next-page header. */
  async getAll<T>(path: string, query: Record<string, string | number | boolean | undefined> = {}, maxPages = 20): Promise<T[]> {
    const out: T[] = []
    let page = 1
    for (let i = 0; i < maxPages; i++) {
      const res = await this.request(path, { per_page: 100, ...query, page })
      out.push(...((await res.json()) as T[]))
      const next = res.headers.get('x-next-page')
      if (!next) break
      page = Number(next)
    }
    return out
  }
}

export const enc = (s: string | number) => encodeURIComponent(String(s))
