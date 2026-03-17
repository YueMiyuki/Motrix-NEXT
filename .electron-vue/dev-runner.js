'use strict'

const path = require('node:path')
const { spawn } = require('node:child_process')
const { say } = require('cfonts')
const electron = require('electron')
const Webpack = require('webpack')

const mainConfig = require('./webpack.main.config')

let electronProcess = null
let viteServer = null
let manualRestart = false
let chalk

function logStats (proc, data) {
  let log = ''

  log += chalk.yellow.bold(`┏ ${proc} Process ${new Array((19 - proc.length) + 1).join('-')}`)
  log += '\n\n'

  if (typeof data === 'object') {
    data.toString({
      colors: true,
      chunks: false
    }).split(/\r?\n/).forEach(line => {
      log += '  ' + line + '\n'
    })
  } else {
    log += `  ${data}\n`
  }

  log += '\n' + chalk.yellow.bold(`┗ ${new Array(28 + 1).join('-')}`) + '\n'

  console.log(log)
}

async function startRenderer () {
  const { createServer } = await import('vite')
  viteServer = await createServer({
    configFile: path.join(__dirname, '../vite.renderer.config.ts'),
    mode: 'development'
  })
  await viteServer.listen()
  logStats('Renderer', chalk.white.bold('vite dev server started: http://localhost:9080'))
}

function startMain () {
  return new Promise((resolve, reject) => {
    mainConfig.entry.main = [path.join(__dirname, '../src/main/index.dev.ts')].concat(mainConfig.entry.main)
    mainConfig.mode = 'development'
    const compiler = Webpack(mainConfig)

    compiler.hooks.watchRun.tapAsync('watch-run', (compilation, done) => {
      logStats('Main', chalk.white.bold('compiling...'))
      // hotMiddleware.publish({ action: 'compiling' })
      done()
    })

    compiler.watch({}, (err, stats) => {
      if (err) {
        console.log(err)
        return
      }

      logStats('Main', stats)

      if (electronProcess && electronProcess.kill) {
        manualRestart = true
        process.kill(electronProcess.pid)
        electronProcess = null
        startElectron()

        setTimeout(() => {
          manualRestart = false
        }, 5000)
      }

      resolve()
    })
  })
}

async function startElectron () {
  electronProcess = spawn(electron, ['--inspect=5858', path.join(__dirname, '../dist/electron/main.js')])

  electronProcess.stdout.on('data', data => {
    electronLog(data, 'blue')
  })
  electronProcess.stderr.on('data', data => {
    electronLog(data, 'red')
  })

  electronProcess.on('close', async () => {
    if (!manualRestart) {
      if (viteServer) {
        await viteServer.close()
      }
      process.exit()
    }
  })
}

function electronLog (data, color) {
  let log = ''
  data = data.toString().split(/\r?\n/)
  data.forEach(line => {
    log += `  ${line}\n`
  })
  if (/[0-9A-z]+/.test(log)) {
    console.log(
      chalk[color].bold('┏ Electron -------------------') +
      '\n\n' +
      log +
      chalk[color].bold('┗ ----------------------------') +
      '\n'
    )
  }
}

function greeting () {
  const cols = process.stdout.columns
  let text = ''

  if (cols > 104) {
    text = 'motrix-dev'
  } else if (cols > 76) {
    text = 'motrix-|dev'
  } else {
    text = false
  }

  if (text) {
    say(text, {
      colors: ['magentaBright'],
      font: 'simple3d',
      space: false
    })
  } else console.log(chalk.magentaBright.bold('\n  motrix-dev'))
  console.log(chalk.blue('  getting ready...') + '\n')
}

async function init () {
  ({ default: chalk } = await import('chalk'))
  greeting()

  try {
    await Promise.all([startRenderer(), startMain()])
    await startElectron()
  } catch (err) {
    console.error(err)
  }
}

init().catch(err => {
  console.error(err)
  process.exit(1)
})
