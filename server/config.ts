export interface Config {
  port: number
  dataDir: string
  gitlabUrl: string
  gitlabToken: string
  /** Numeric id or full path, e.g. "group/sub/project". */
  gitlabProject: string
  branch: string
  timetrackingDir: string
  /** Only show time entries of this GitLab user id. Defaults to the token's own user. */
  timetrackingUserId: number | null
  demo: boolean
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8080),
    dataDir: env.DATA_DIR ?? './data',
    gitlabUrl: (env.GITLAB_URL ?? 'https://gitlab.windesheim.nl').replace(/\/+$/, ''),
    gitlabToken: env.GITLAB_TOKEN ?? '',
    gitlabProject: env.GITLAB_PROJECT ?? '',
    branch: env.TIMETRACKING_BRANCH ?? 'develop',
    timetrackingDir: (env.TIMETRACKING_DIR ?? '.timetracking').replace(/^\/+|\/+$/g, ''),
    timetrackingUserId: env.TIMETRACKING_USER_ID ? Number(env.TIMETRACKING_USER_ID) : null,
    demo: env.DEMO === '1' || env.DEMO === 'true',
  }
}
