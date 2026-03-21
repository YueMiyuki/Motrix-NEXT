import cfonts from 'cfonts'
import chalk from 'chalk'
import { spawn } from 'node:child_process'

const isCI = process.env.CI || false

const doneLog = chalk.bgGreen.white(' DONE ') + ' '
const errorLog = chalk.bgRed.white(' ERROR ') + ' '

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

if (process.platform === 'win32') {
  tauriArgs.push('--config', 'src-tauri/tauri.windows.conf.json')
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
