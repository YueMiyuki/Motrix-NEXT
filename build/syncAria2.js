'use strict'

const { createHash } = require('node:crypto')
const path = require('node:path')
const fs = require('node:fs/promises')

const REPO_ROOT = path.resolve(__dirname, '..')

const METADATA_URLS = [
  process.env.ARIA2_LATEST_JSON_URL,
  'https://github.com/YueMiyuki/aria2/releases/latest/download/latest.json',
  'https://api.github.com/repos/YueMiyuki/aria2/releases/latest',
].filter(Boolean)

const ENGINE_TARGETS = [
  {
    platform: 'darwin',
    arch: 'x64',
    outputDir: 'extra/darwin/x64/engine',
    outputName: 'aria2c',
  },
  {
    platform: 'darwin',
    arch: 'arm64',
    outputDir: 'extra/darwin/arm64/engine',
    outputName: 'aria2c',
  },
  {
    platform: 'linux',
    arch: 'x64',
    outputDir: 'extra/linux/x64/engine',
    outputName: 'aria2c',
  },
  {
    platform: 'linux',
    arch: 'arm64',
    outputDir: 'extra/linux/arm64/engine',
    outputName: 'aria2c',
  },
  {
    platform: 'linux',
    arch: 'armv7l',
    outputDir: 'extra/linux/armv7l/engine',
    outputName: 'aria2c',
  },
  {
    platform: 'win',
    arch: 'x64',
    outputDir: 'extra/win32/x64/engine',
    outputName: 'aria2c.exe',
  },
  {
    platform: 'win',
    arch: 'ia32',
    outputDir: 'extra/win32/ia32/engine',
    outputName: 'aria2c.exe',
  },
]

const PLATFORM_ALIASES = {
  darwin: new Set(['darwin', 'macos', 'mac']),
  linux: new Set(['linux']),
  win: new Set(['win', 'win32', 'windows']),
}

const ARCH_ALIASES = {
  x64: new Set(['x64', 'amd64']),
  arm64: new Set(['arm64', 'aarch64']),
  armv7l: new Set(['armv7l', 'armv7', 'arm']),
  ia32: new Set(['ia32', 'x86']),
}

const DRY_RUN = process.env.ARIA2_SYNC_DRY_RUN === 'true'
const SKIP_SYNC = process.env.SKIP_ARIA2_SYNC === 'true'

async function getFetch() {
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis)
  }
  const pkg = await import('node-fetch')
  return pkg.default
}

function parseApiAssetName(name = '') {
  const match = name.match(/^(darwin|linux|win)-([a-z0-9]+)(?:\.exe)?$/i)
  if (!match) {
    return null
  }
  return {
    platform: match[1].toLowerCase(),
    arch: match[2].toLowerCase(),
  }
}

function normalizeMetadata(payload) {
  const version = payload.version || payload.tag_name || payload.name || ''
  const assets = []

  const sourceAssets = Array.isArray(payload.assets) ? payload.assets : []
  sourceAssets.forEach((asset) => {
    if (!asset || typeof asset !== 'object') {
      return
    }

    const explicitPlatform = String(asset.platform || '').toLowerCase()
    const explicitArch = String(asset.arch || '').toLowerCase()
    const parsedByName = parseApiAssetName(String(asset.name || ''))

    const platform = explicitPlatform || (parsedByName && parsedByName.platform) || ''
    const arch = explicitArch || (parsedByName && parsedByName.arch) || ''
    const url = asset.url || asset.browser_download_url

    if (!platform || !arch || !url) {
      return
    }

    assets.push({
      name: String(asset.name || ''),
      platform,
      arch,
      url: String(url),
      sha256: asset.sha256 ? String(asset.sha256).toLowerCase() : '',
      size: Number(asset.size || 0),
    })
  })

  return {
    version: String(version),
    assets,
  }
}

function isMatchWithAliases(value, aliases) {
  if (!value) {
    return false
  }
  const normalized = value.toLowerCase()
  if (aliases && aliases.has(normalized)) {
    return true
  }
  return false
}

function findAsset(assets, target) {
  return assets.find(
    (asset) =>
      isMatchWithAliases(asset.platform, PLATFORM_ALIASES[target.platform]) &&
      isMatchWithAliases(asset.arch, ARCH_ALIASES[target.arch]),
  )
}

async function hashFile(filePath) {
  const data = await fs.readFile(filePath)
  const hash = createHash('sha256').update(data).digest('hex')
  return hash
}

async function fetchJsonWithFallbacks(fetchImpl) {
  const errors = []

  for (const url of METADATA_URLS) {
    try {
      const response = await fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Motrix-NEXT/aria2-sync',
        },
        redirect: 'follow',
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const json = await response.json()
      const normalized = normalizeMetadata(json)
      if (!normalized.assets.length) {
        throw new Error('metadata contains no usable assets')
      }
      return {
        metadata: normalized,
        sourceUrl: url,
      }
    } catch (error) {
      errors.push(`${url} -> ${error.message}`)
    }
  }

  throw new Error(
    ['Unable to fetch aria2 metadata from all configured URLs.', ...errors].join('\n'),
  )
}

async function downloadAsset(fetchImpl, asset, outputPath) {
  const response = await fetchImpl(asset.url, {
    headers: {
      'User-Agent': 'Motrix-NEXT/aria2-sync',
    },
    redirect: 'follow',
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${asset.url}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  if (asset.sha256) {
    const digest = createHash('sha256').update(buffer).digest('hex')
    if (digest !== asset.sha256) {
      throw new Error(
        `Checksum mismatch for ${asset.name}: expected ${asset.sha256}, got ${digest}`,
      )
    }
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, buffer)
  if (!outputPath.endsWith('.exe')) {
    await fs.chmod(outputPath, 0o755)
  }
}

async function syncTarget(fetchImpl, metadata, target) {
  const asset = findAsset(metadata.assets, target)
  if (!asset) {
    throw new Error(`Missing aria2 asset for ${target.platform}/${target.arch}`)
  }

  const outputPath = path.join(REPO_ROOT, target.outputDir, target.outputName)
  const outputLabel = `${target.platform}/${target.arch} -> ${path.relative(REPO_ROOT, outputPath)}`

  if (asset.sha256) {
    try {
      const currentHash = await hashFile(outputPath)
      if (currentHash === asset.sha256) {
        console.log(`[aria2-sync] up-to-date ${outputLabel}`)
        return
      }
    } catch (error) {
      // Ignore missing files and continue to download.
    }
  }

  if (DRY_RUN) {
    console.log(`[aria2-sync] DRY_RUN would update ${outputLabel} from ${asset.url}`)
    return
  }

  await downloadAsset(fetchImpl, asset, outputPath)
  console.log(`[aria2-sync] updated ${outputLabel} from ${asset.url}`)
}

async function syncAria2Binaries() {
  if (SKIP_SYNC) {
    console.log('[aria2-sync] skipped (SKIP_ARIA2_SYNC=true)')
    return
  }

  const fetchImpl = await getFetch()
  const { metadata, sourceUrl } = await fetchJsonWithFallbacks(fetchImpl)
  console.log(
    `[aria2-sync] metadata source: ${sourceUrl}; version: ${metadata.version || 'unknown'}`,
  )

  for (const target of ENGINE_TARGETS) {
    await syncTarget(fetchImpl, metadata, target)
  }
}

if (require.main === module) {
  syncAria2Binaries().catch((error) => {
    console.error('[aria2-sync] failed')
    console.error(error?.stack || error)
    process.exit(1)
  })
}

module.exports = {
  syncAria2Binaries,
}
