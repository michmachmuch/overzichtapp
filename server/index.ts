import { join, resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { loadConfig } from './config.ts'
import { GitLabClient } from './gitlab.ts'
import { Service } from './service.ts'
import { Store } from './store.ts'
import { createApp } from './app.ts'
import { demoFetch } from './demo.ts'

const config = loadConfig()
if (config.demo) Object.assign(config, { gitlabProject: 'demo', gitlabUrl: 'https://gitlab.example' })
const gl = config.demo
  ? new GitLabClient('https://gitlab.example', 'demo', demoFetch())
  : new GitLabClient(config.gitlabUrl, config.gitlabToken)
const dataDir = resolve(config.dataDir)
mkdirSync(dataDir, { recursive: true })
const service = new Service(config, gl, config.demo ? null : join(dataDir, 'gitlab-cache.json'))
const store = new Store(dataDir)
const staticDir = resolve('dist')

createApp(service, store, existsSync(staticDir) ? staticDir : null).listen(config.port, () => {
  console.log(`Overzicht draait op http://localhost:${config.port}`)
  if (config.demo) console.log('Demo-modus: er wordt niets van GitLab gelezen.')
  else if (!service.configured) console.log('Let op: GITLAB_TOKEN en GITLAB_PROJECT zijn niet ingesteld (zie .env.example).')
})
