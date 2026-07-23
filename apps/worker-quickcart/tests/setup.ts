import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(filePath: string): void {
  const content = readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    const value = trimmed.slice(eqIndex + 1).trim()

    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

const envFile = resolve(import.meta.dir, '../../../envs/env.test')
loadEnvFile(envFile)
