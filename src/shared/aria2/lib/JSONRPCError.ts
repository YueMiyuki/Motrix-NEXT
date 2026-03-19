'use strict'

export class JSONRPCError extends Error {
  [key: string]: any
  constructor({ message, code, data }) {
    super(message)
    this.code = code
    if (data) this.data = data
    this.name = this.constructor.name
  }
}
