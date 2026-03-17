import 'vue'

declare module '@vue/runtime-core' {
  interface ComponentCustomProperties {
    [key: string]: any
    $store: any
    $router: any
    $route: any
    $http: any
    $electron: any
    $msg: any
    $native: any
    $t: (key: string, value?: any) => any
  }
}

export {}
