import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(dirname, '..')
const metadataUrl = 'https://github.com/YueMiyuki/aria2/releases/latest/download/latest.json'

const targets = [
  { platform: 'darwin', arch: 'x64', output: 'extra/darwin/x64/engine/aria2c' },
  { platform: 'darwin', arch: 'arm64', output: 'extra/darwin/arm64/engine/aria2c' },
  { platform: 'linux', arch: 'x64', output: 'extra/linux/x64/engine/aria2c' },
  { platform: 'linux', arch: 'arm64', output: 'extra/linux/arm64/engine/aria2c' },
  { platform: 'linux', arch: 'armv7l', output: 'extra/linux/armv7l/engine/aria2c' },
  { platform: 'win', arch: 'x64', output: 'extra/win32/x64/engine/aria2c.exe' },
  { platform: 'win', arch: 'ia32', output: 'extra/win32/ia32/engine/aria2c.exe' },
]

function sha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

async function fetchBuffer(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch asset ${url}: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

async function main() {
  console.log(`Syncing aria2 binaries using ${metadataUrl}`)
  const metadata = await fetchJson(metadataUrl)
  const version = metadata?.version || metadata?.name || 'unknown'
  const assets = Array.isArray(metadata?.assets) ? metadata.assets : []

  if (assets.length === 0) {
    throw new Error('latest.json does not contain any assets')
  }

  for (const target of targets) {
    const asset = assets.find(
      (item) => item.platform === target.platform && item.arch === target.arch,
    )
    if (!asset?.url) {
      throw new Error(`Missing aria2 asset for ${target.platform}/${target.arch}`)
    }

    const outputPath = path.resolve(rootDir, target.output)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    const payload = await fetchBuffer(asset.url)

    if (asset.sha256) {
      const digest = sha256Hex(payload)
      if (digest !== String(asset.sha256).toLowerCase()) {
        throw new Error(
          `Checksum mismatch for ${asset.name}: expected ${asset.sha256}, got ${digest}`,
        )
      }
    }

    fs.writeFileSync(outputPath, payload)
    if (!outputPath.endsWith('.exe')) {
      fs.chmodSync(outputPath, 0o755)
    }
    console.log(`Synced ${asset.name} -> ${target.output}`)
  }

  const versionMetaPath = path.resolve(rootDir, 'extra/aria2-version.json')
  fs.writeFileSync(
    versionMetaPath,
    `${JSON.stringify(
      {
        version,
        syncedAt: new Date().toISOString(),
        source: metadataUrl,
      },
      null,
      2,
    )}\n`,
  )
  console.log(`Updated extra/aria2-version.json (${version})`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
