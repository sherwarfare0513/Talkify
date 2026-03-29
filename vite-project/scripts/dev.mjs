import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const serverPackagePath = path.resolve('server', 'package.json')
const children = []

if (fs.existsSync(serverPackagePath)) {
  children.push(
    spawn(npmCmd, ['run', 'server'], { stdio: 'inherit', shell: process.platform === 'win32' }),
  )
} else {
  console.log('Server folder nahin mila, sirf frontend dev server start ho raha hai.')
}

children.push(
  spawn(npmCmd, ['run', 'dev:client'], { stdio: 'inherit', shell: process.platform === 'win32' }),
)

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) {
      child.kill()
    }
  }
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
