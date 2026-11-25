export const DAYS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag']
export const DAYS_SHORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo']
export const MONTHS = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december']

/** Local date as YYYY-MM-DD (not UTC). */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return addDays(x, -((x.getDay() + 6) % 7))
}

export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  return Math.ceil(((t.getTime() - y0.getTime()) / 86400000 + 1) / 7)
}

export function duration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  if (!h) return `${m} min`
  return m ? `${h}u ${m}m` : `${h}u`
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function longDate(d: Date): string {
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function relative(iso: string | null, now = new Date()): string {
  if (!iso) return 'nog nooit'
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'zojuist'
  if (mins < 60) return `${mins} min geleden`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h} uur geleden`
  const d = Math.round(h / 24)
  return d === 1 ? 'gisteren' : `${d} dagen geleden`
}

/** Whole days from today to a date (negative = past). */
export function daysUntil(date: string, today = new Date()): number {
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((parseYmd(date).getTime() - a.getTime()) / 86400000)
}

/** YYYY-MM-DD → dd/mm/yyyy */
export function dmy(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : isoDate
}

/** dd/mm/yyyy (also d-m-yyyy or d.m.yyyy) → YYYY-MM-DD, or null when it isn't a real date. */
export function parseDmy(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!m) return null
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(y, mo - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null
  return ymd(date)
}
