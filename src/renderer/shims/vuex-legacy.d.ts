declare module 'vuex' {
  export const Store: any
  export function createStore (...args: any[]): any
  export function useStore (...args: any[]): any
  export function mapState (...args: any[]): any
  export function mapGetters (...args: any[]): any
  export function mapMutations (...args: any[]): any
  export function mapActions (...args: any[]): any
}
