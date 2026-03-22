import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(dirname, '..')

const expectedTargets = [
  { platform: 'darwin', arch: 'x64', bin: 'aria2c' },
  { platform: 'darwin', arch: 'arm64', bin: 'aria2c' },
  { platform: 'linux', arch: 'x64', bin: 'aria2c' },
  { platform: 'linux', arch: 'arm64', bin: 'aria2c' },
  { platform: 'linux', arch: 'armv7l', bin: 'aria2c' },
  { platform: 'win32', arch: 'x64', bin: 'aria2c.exe' },
  { platform: 'win32', arch: 'ia32', bin: 'aria2c.exe' },
  { platform: 'win32', arch: 'arm64', bin: 'aria2c.exe' },
]

function fileExistsAndNonEmpty(filePath) {
  try {
    const stat = fs.statSync(filePath)
    return stat.isFile() && stat.size > 0
  } catch {
    return false
  }
}

function main() {
  const missing = []

  for (const target of expectedTargets) {
    const engineDir = path.resolve(rootDir, 'extra', target.platform, target.arch, 'engine')
    const binPath = path.join(engineDir, target.bin)
    const confPath = path.join(engineDir, 'aria2.conf')

    const hasBin = fileExistsAndNonEmpty(binPath)
    const hasConf = fileExistsAndNonEmpty(confPath)

    if (!hasBin) {
      missing.push(path.relative(rootDir, binPath))
    }
    if (!hasConf) {
      missing.push(path.relative(rootDir, confPath))
    }

    console.log(
      `${target.platform}/${target.arch}: ${hasBin ? 'bin ok' : 'bin missing'}, ${hasConf ? 'conf ok' : 'conf missing'}`,
    )
  }

  if (missing.length > 0) {
    console.error('\nMissing required aria2 assets:')
    for (const file of missing) {
      console.error(`- ${file}`)
    }
    process.exit(1)
  }

  console.log('\nAll required aria2 engine assets are present.')
}

main()
