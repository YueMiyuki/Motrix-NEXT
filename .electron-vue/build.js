'use strict'

process.env.NODE_ENV = 'production'

const path = require('node:path')
const { say } = require('cfonts')
const Webpack = require('webpack')
const Multispinner = require('@motrix/multispinner')
const { syncAria2Binaries } = require('../build/syncAria2')

const mainConfig = require('./webpack.main.config')

const isCI = process.env.CI || false
let chalk
let deleteSync
let doneLog = 'DONE '
let errorLog = 'ERROR '
let okayLog = 'OKAY '

init().catch(handleFatalError)

async function init() {
  ;({ default: chalk } = await import('chalk'))
  ;({ deleteSync } = await import('del'))
  doneLog = chalk.bgGreen.white(' DONE ') + ' '
  errorLog = chalk.bgRed.white(' ERROR ') + ' '
  okayLog = chalk.bgBlue.white(' OKAY ') + ' '

  if (process.env.BUILD_TARGET === 'clean') {
    clean()
  } else if (process.env.BUILD_TARGET === 'web') {
    await web()
  } else {
    await build()
  }
}

function clean() {
  deleteSync(['release/*', '!.gitkeep'])
  console.log(`\n${doneLog}\n`)
  process.exit()
}

async function build() {
  greeting()

  await syncAria2Binaries()

  deleteSync(['dist/electron/*', '!.gitkeep'])

  const tasks = ['main', 'renderer']
  const m = new Multispinner(tasks, {
    preText: 'building',
    postText: 'process',
  })

  let results = ''

  m.on('success', () => {
    process.stdout.write('\x1B[2J\x1B[0f')
    console.log(`\n\n${results}`)
    console.log(`${okayLog}take it away ${chalk.yellow('`electron-builder`')}\n`)
    process.exit()
  })

  packMain(mainConfig)
    .then((result) => {
      results += result + '\n\n'
      m.success('main')
    })
    .catch((err) => {
      m.error('main')
      console.log(`\n  ${errorLog}failed to build main process`)
      console.error(`\n${err}\n`)
      process.exit(1)
    })

  packRenderer()
    .then((result) => {
      results += result + '\n\n'
      m.success('renderer')
    })
    .catch((err) => {
      m.error('renderer')
      console.log(`\n  ${errorLog}failed to build renderer process`)
      console.error(`\n${err}\n`)
      process.exit(1)
    })
}

function packMain(config) {
  return new Promise((resolve, reject) => {
    config.mode = 'production'
    Webpack(config, (err, stats) => {
      if (err) {
        reject(err.stack || err)
      } else if (stats.hasErrors()) {
        let buildErr = ''
        stats
          .toString({
            chunks: false,
            colors: true,
          })
          .split(/\r?\n/)
          .forEach((line) => {
            buildErr += `    ${line}\n`
          })

        reject(buildErr)
      } else {
        resolve(
          stats.toString({
            chunks: false,
            colors: true,
          }),
        )
      }
    })
  })
}

async function packRenderer() {
  const { build } = await import('vite')
  await build({
    configFile: path.join(__dirname, '../vite.renderer.config.ts'),
    mode: 'production',
  })
  return chalk.green('  Vite renderer build completed')
}

async function web() {
  const { build } = await import('vite')
  await build({
    configFile: path.join(__dirname, '../vite.renderer.config.ts'),
    mode: 'production',
    build: {
      outDir: path.join(__dirname, '../dist/web'),
      emptyOutDir: true,
    },
  })

  console.log(`${okayLog}web bundle generated in dist/web`)
  process.exit()
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
    say(text, {
      colors: ['magentaBright'],
      font: 'simple3d',
      space: false,
    })
  } else {
    console.log(chalk.magentaBright.bold('\n  lets-build'))
  }
  console.log()
}

function handleFatalError(err) {
  console.log(`\n  ${errorLog}build failed`)
  console.error(`\n${err?.stack || err}\n`)
  process.exit(1)
}
