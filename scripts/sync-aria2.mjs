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
  { platform: 'win32', arch: 'x64', output: 'extra/win32/x64/engine/aria2c.exe' },
  { platform: 'win32', arch: 'ia32', output: 'extra/win32/ia32/engine/aria2c.exe' },
  { platform: 'win32', arch: 'arm64', output: 'extra/win32/arm64/engine/aria2c.exe' },
]

const platformAliases = {
  darwin: 'darwin',
  mac: 'darwin',
  macos: 'darwin',
  osx: 'darwin',
  linux: 'linux',
  win: 'win32',
  windows: 'win32',
  win32: 'win32',
}

const archAliases = {
  x64: 'x64',
  amd64: 'x64',
  x86_64: 'x64',
  ia32: 'ia32',
  i386: 'ia32',
  i686: 'ia32',
  x86: 'ia32',
  arm64: 'arm64',
  aarch64: 'arm64',
  armv7l: 'armv7l',
  armv7: 'armv7l',
}

function normalizePlatform(platform) {
  if (!platform) return null
  return platformAliases[String(platform).toLowerCase()] || null
}

function normalizeArch(arch) {
  if (!arch) return null
  return archAliases[String(arch).toLowerCase()] || null
}

function makeTargetKey(platform, arch) {
  const normalizedPlatform = normalizePlatform(platform)
  const normalizedArch = normalizeArch(arch)
  if (!normalizedPlatform || !normalizedArch) {
    return null
  }
  return `${normalizedPlatform}/${normalizedArch}`
}

function ensureConfFile(target) {
  const outputPath = path.resolve(rootDir, target.output)
  const engineDir = path.dirname(outputPath)
  const confPath = path.join(engineDir, 'aria2.conf')

  if (fs.existsSync(confPath)) {
    return
  }

  const candidates = [
    path.resolve(rootDir, `extra/${target.platform}/x64/engine/aria2.conf`),
    path.resolve(rootDir, `extra/${target.platform}/ia32/engine/aria2.conf`),
    path.resolve(rootDir, `extra/${target.platform}/arm64/engine/aria2.conf`),
  ]

  const source = candidates.find((candidate) => fs.existsSync(candidate))
  if (!source) {
    throw new Error(`Missing aria2.conf template for ${target.platform}/${target.arch}`)
  }

  fs.copyFileSync(source, confPath)
  console.log(`Copied ${path.relative(rootDir, source)} -> ${path.relative(rootDir, confPath)}`)
}

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
  const assetMap = new Map()

  if (assets.length === 0) {
    throw new Error('latest.json does not contain any assets')
  }

  for (const asset of assets) {
    const key = makeTargetKey(asset?.platform, asset?.arch)
    if (!key) {
      console.warn(
        `Skipping metadata asset with unknown platform/arch: ${asset?.name || 'unknown'}`,
      )
      continue
    }
    assetMap.set(key, asset)
  }

  console.log(`Found ${assets.length} assets in metadata, syncing for version ${version}...`)

  for (const target of targets) {
    const targetKey = makeTargetKey(target.platform, target.arch)
    const asset = targetKey ? assetMap.get(targetKey) : null
    if (!asset?.url) {
      throw new Error(`Missing aria2 asset for ${target.platform}/${target.arch}`)
    }

    const outputPath = path.resolve(rootDir, target.output)
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    const payload = await fetchBuffer(asset.url)

    if (asset.sha256) {
      const digest = sha256Hex(payload)
      console.log(`Verifying checksum for ${asset.name}: expected ${asset.sha256}, got ${digest}`)
      if (digest !== String(asset.sha256).toLowerCase()) {
        throw new Error(
          `Checksum mismatch for ${asset.name}: expected ${asset.sha256}, got ${digest}`,
        )
      }
    }

    const tmpOutputPath = `${outputPath}.tmp-${process.pid}-${crypto.randomUUID()}`
    fs.writeFileSync(tmpOutputPath, payload)
    if (!outputPath.endsWith('.exe')) {
      fs.chmodSync(tmpOutputPath, 0o755)
    }
    fs.renameSync(tmpOutputPath, outputPath)
    ensureConfFile(target)
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
