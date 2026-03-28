import { spawn } from 'node:child_process'

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const children = [
  spawn(npmCmd, ['run', 'server'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  spawn(npmCmd, ['run', 'dev:client'], { stdio: 'inherit', shell: process.platform === 'win32' }),
]

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill()
    }
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
