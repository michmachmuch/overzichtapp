import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { LocalData } from '../shared/types.ts'

export function defaultData(): LocalData {
  return {
    version: 1,
    checkins: [
      {
        id: randomUUID(),
        title: 'WhatsApp-groep',
        kind: 'link',
        url: 'https://web.whatsapp.com',
        info: 'Lees nieuwe berichten van het team. Zijn er vragen aan jou, afspraken of wijzigingen in de planning?',
        lastCheckedAt: null,
      },
      {
        id: randomUUID(),
        title: 'Issueboard',
        kind: 'gitlab-issues',
        url: '',
        info: 'Bekijk nieuwe issues. Is er iets voor jou, moet iets verfijnd worden, of kun je een issue oppakken?',
        lastCheckedAt: null,
      },
      {
        id: randomUUID(),
        title: 'Merge requests',
        kind: 'gitlab-merge-requests',
        url: '',
        info: 'Staan er merge requests open die een review nodig hebben? Zijn er reacties op jouw merge requests?',
        lastCheckedAt: null,
      },
    ],
    deadlines: [],
    sprints: [],
    sprintHoursTarget: 64,
    todos: [],
  }
}

/** Fills in fields added in later versions, so older data files keep working. */
export function migrate(d: LocalData): LocalData {
  return {
    ...d,
    sprints: Array.isArray(d.sprints) ? d.sprints : [],
    sprintHoursTarget: typeof d.sprintHoursTarget === 'number' && d.sprintHoursTarget > 0 ? d.sprintHoursTarget : 64,
  }
}

export function isLocalData(v: unknown): v is LocalData {
  const d = v as LocalData
  return !!d && d.version === 1 && Array.isArray(d.checkins) && Array.isArray(d.deadlines) && Array.isArray(d.todos)
}

/** Stores your own data (check-ins, deadlines, to-dos) as one JSON file in the data volume. */
export class Store {
  private readonly file: string
  private readonly dir: string
  private cache: LocalData | null = null

  constructor(dir: string) {
    this.dir = dir
    this.file = join(dir, 'data.json')
  }

  async read(): Promise<LocalData> {
    if (this.cache) return this.cache
    try {
      const parsed = JSON.parse(await readFile(this.file, 'utf8'))
      this.cache = isLocalData(parsed) ? migrate(parsed) : defaultData()
    } catch {
      this.cache = defaultData()
      await this.write(this.cache)
    }
    return this.cache
  }

  async write(data: LocalData): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    const tmp = this.file + '.tmp'
    await writeFile(tmp, JSON.stringify(data, null, 2))
    await rename(tmp, this.file)
    this.cache = data
  }
}
