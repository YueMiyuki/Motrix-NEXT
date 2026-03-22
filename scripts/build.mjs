import cfonts from 'cfonts'
import chalk from 'chalk'
import { spawn } from 'node:child_process'

const isCI = process.env.CI || false

const doneLog = chalk.bgGreen.white(' DONE ') + ' '
const errorLog = chalk.bgRed.white(' ERROR ') + ' '

const TARGET_CONFIG_MAP = {
  'darwin/x64': 'src-tauri/tauri.darwin.x64.conf.json',
  'darwin/arm64': 'src-tauri/tauri.darwin.arm64.conf.json',
  'linux/x64': 'src-tauri/tauri.linux.x64.conf.json',
  'linux/arm64': 'src-tauri/tauri.linux.arm64.conf.json',
  'linux/armv7l': 'src-tauri/tauri.linux.armv7l.conf.json',
  'win32/x64': 'src-tauri/tauri.win32.x64.conf.json',
  'win32/ia32': 'src-tauri/tauri.win32.ia32.conf.json',
  'win32/arm64': 'src-tauri/tauri.win32.arm64.conf.json',
}

function greeting() {
  const cols = process.stdout.columns
  let text = ''

  if (cols > 85) {
    text = 'lets-build'
  } else if (cols > 60) {
    text = 'lets-|build'
  } else {
    text = false
  }

  if (text && !isCI) {
    cfonts.say(text, {
      colors: ['magentaBright'],
      font: 'simple3d',
      space: false,
    })
  } else {
    console.log(chalk.magentaBright.bold('\n  lets-build'))
  }

  console.log(chalk.blue('  building Motrix for production...') + '\n')
}

greeting()

const args = process.argv.slice(2)
const tauriArgs = ['tauri', 'build', ...args]

function findOptionValue(rawArgs, flags) {
  for (const flag of flags) {
    const index = rawArgs.indexOf(flag)
    if (index !== -1 && rawArgs[index + 1]) {
      return rawArgs[index + 1]
    }
    const prefixed = rawArgs.find((arg) => arg.startsWith(`${flag}=`))
    if (prefixed) {
      return prefixed.slice(flag.length + 1)
    }
  }
  return null
}

function hasOption(rawArgs, flags) {
  return flags.some(
    (flag) => rawArgs.includes(flag) || rawArgs.some((arg) => arg.startsWith(`${flag}=`)),
  )
}

function resolvePlatformArchFromTarget(target) {
  if (!target) return null

  if (target.includes('apple-darwin')) {
    if (target.startsWith('aarch64-')) return 'darwin/arm64'
    if (target.startsWith('x86_64-')) return 'darwin/x64'
  }

  if (target.includes('windows-msvc') || target.includes('windows-gnu')) {
    if (target.startsWith('aarch64-')) return 'win32/arm64'
    if (target.startsWith('x86_64-')) return 'win32/x64'
    if (target.startsWith('i686-')) return 'win32/ia32'
  }

  if (target.includes('linux')) {
    if (target.startsWith('aarch64-')) return 'linux/arm64'
    if (target.startsWith('x86_64-')) return 'linux/x64'
    if (target.startsWith('armv7-') || target.startsWith('arm-')) {
      return 'linux/armv7l'
    }
  }

  return null
}

function resolvePlatformArchFromHost() {
  const platform = process.platform
  const archMap = {
    x64: 'x64',
    arm64: 'arm64',
    ia32: 'ia32',
    arm: 'armv7l',
  }
  const arch = archMap[process.arch]
  if (!arch) return null
  return `${platform}/${arch}`
}

const target = findOptionValue(args, ['--target', '-t'])
const targetKey = resolvePlatformArchFromTarget(target) ?? resolvePlatformArchFromHost()
const resourceConfig = targetKey ? TARGET_CONFIG_MAP[targetKey] : null
const userProvidedConfig = hasOption(args, ['--config', '-c'])

if (!userProvidedConfig && resourceConfig) {
  tauriArgs.push('--config', resourceConfig)
  console.log(chalk.blue(`  using aria2 resource config: ${resourceConfig}`))
} else if (!userProvidedConfig && !resourceConfig) {
  console.log(
    chalk.yellow('  warning: unknown target/host architecture, using default tauri resources'),
  )
}

const child = spawn('pnpm', tauriArgs, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env },
})

child.on('close', (code) => {
  if (code === 0) {
    console.log(`\n${doneLog}build complete\n`)
  } else {
    console.log(`\n${errorLog}build failed with code ${code}\n`)
  }
  process.exit(code)
})
