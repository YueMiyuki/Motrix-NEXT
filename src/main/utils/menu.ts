import { parse } from 'querystring'

export const translateTemplate = (template, keystrokesByCommand, i18n) => {
  for (const i in template) {
    const item = template[i]
    if (item.command) {
      item.accelerator = acceleratorForCommand(item.command, keystrokesByCommand)
    }

    // If label is specified, label is used as the key of i18n.t(key),
    // which mainly solves the inaccurate translation of item.id.
    if (i18n) {
      if (item.label) {
        item.label = i18n.t(item.label)
      } else if (item.id) {
        item.label = i18n.t(item.id)
      }
    }

    item.click = () => {
      handleCommand(item)
    }

    if (item.submenu) {
      translateTemplate(item.submenu, keystrokesByCommand, i18n)
    }
  }
  return template
}

export const handleCommand = (item) => {
  handleCommandBefore(item)

  const args = item['command-arg'] ? [item.command, item['command-arg']] : [item.command]

  global.application.sendCommandToAll(...args)

  handleCommandAfter(item)
}

function handleCommandBefore(item) {
  if (!item['command-before']) {
    return
  }
  const [command, params] = item['command-before'].split('?')
  const args = parse(params)
  global.application.sendCommandToAll(command, args)
}

function handleCommandAfter(item) {
  if (!item['command-after']) {
    return
  }
  const [command, params] = item['command-after'].split('?')
  const args = parse(params)
  global.application.sendCommandToAll(command, args)
}

function acceleratorForCommand(command, keystrokesByCommand) {
  const keystroke = keystrokesByCommand[command]
  if (keystroke) {
    let modifiers = keystroke.split(/-(?=.)/)
    const key = modifiers.pop().toUpperCase().replace('+', 'Plus').replace('MINUS', '-')
    modifiers = modifiers.map((modifier) => {
      if (process.platform === 'darwin') {
        return modifier
          .replace(/cmdctrl/gi, 'Cmd')
          .replace(/shift/gi, 'Shift')
          .replace(/cmd/gi, 'Cmd')
          .replace(/ctrl/gi, 'Ctrl')
          .replace(/alt/gi, 'Alt')
      } else {
        return modifier
          .replace(/cmdctrl/gi, 'Ctrl')
          .replace(/shift/gi, 'Shift')
          .replace(/ctrl/gi, 'Ctrl')
          .replace(/alt/gi, 'Alt')
      }
    })
    const keys = modifiers.concat([key])
    return keys.join('+')
  }
  return null
}

export const flattenMenuItems = (menu) => {
  const flattenItems = {}
  menu.items.forEach((item) => {
    if (item.id) {
      flattenItems[item.id] = item
      if (item.submenu) {
        Object.assign(flattenItems, flattenMenuItems(item.submenu))
      }
    }
  })
  return flattenItems
}

export const updateStates = (itemsById, visibleStates, enabledStates, checkedStates) => {
  if (visibleStates) {
    for (const command in visibleStates) {
      const item = itemsById[command]
      if (item) {
        item.visible = visibleStates[command]
      }
    }
  }
  if (enabledStates) {
    for (const command in enabledStates) {
      const item = itemsById[command]
      if (item) {
        item.enabled = enabledStates[command]
      }
    }
  }
  if (checkedStates) {
    for (const id in checkedStates) {
      const item = itemsById[id]
      if (item) {
        item.checked = checkedStates[id]
      }
    }
  }
}
