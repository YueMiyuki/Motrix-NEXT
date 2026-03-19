import { createPinia, setActivePinia } from 'pinia'

const pinia = createPinia()
setActivePinia(pinia)

export default pinia

export * from './app'
export * from './preference'
export * from './task'
