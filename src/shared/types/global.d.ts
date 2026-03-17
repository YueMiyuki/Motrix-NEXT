declare const appId: string
declare const __static: string

declare global {
  // eslint-disable-next-line no-var
  var appId: string
  // eslint-disable-next-line no-var
  var __static: string
  // eslint-disable-next-line no-var
  var launcher: unknown
  // eslint-disable-next-line no-var
  var app: unknown
}

export {}
