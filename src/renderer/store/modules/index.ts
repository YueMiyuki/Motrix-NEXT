/**
 * The file enables `@/store/index.ts` to import all vuex modules
 * in a one-shot manner. There should not be any reason to edit this file.
 */

const modules = {}

const files = import.meta.glob('./*.ts', { eager: true }) as Record<string, any>

Object.keys(files).forEach((key) => {
  if (key === './index.ts') {
    return
  }

  const moduleName = key.replace(/(\.\/|\.ts)/g, '')
  modules[moduleName] = files[key].default
})

export default modules
