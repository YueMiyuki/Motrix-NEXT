'use strict'

import EventEmitter from 'eventemitter3'
import defaultFetch from 'cross-fetch'
import defaultWebSocket from 'isomorphic-ws'
import { JSONRPCError } from './JSONRPCError'
import Deferred from './Deferred'
import promiseEvent from './promiseEvent'

const runtimeGlobal: any = typeof globalThis !== 'undefined' ? globalThis : {}
const defaultRuntimeWebSocket = runtimeGlobal.WebSocket || defaultWebSocket
const defaultRuntimeFetch = runtimeGlobal.fetch
  ? runtimeGlobal.fetch.bind(runtimeGlobal)
  : defaultFetch

export class JSONRPCClient extends EventEmitter {
  [key: string]: any
  constructor(options: any = {}) {
    super()
    this.deferreds = Object.create(null)
    this.lastId = 0

    Object.assign(this, JSONRPCClient.defaultOptions, options)
  }

  id() {
    return this.lastId++
  }

  url(protocol) {
    return protocol + (this.secure ? 's' : '') + '://' + this.host + ':' + this.port + this.path
  }

  websocket(message) {
    return new Promise<void>((resolve, reject) => {
      const cb = (err?: Error | null) => {
        if (err) reject(err)
        else resolve()
      }
      this.socket.send(JSON.stringify(message), cb)
      if (runtimeGlobal.WebSocket && this.socket instanceof runtimeGlobal.WebSocket) cb()
    })
  }

  async http(message) {
    const response = await this.fetch(this.url('http'), {
      method: 'POST',
      body: JSON.stringify(message),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })

    response
      .json()
      .then(this._onmessage)
      .catch((err) => {
        this.emit('error', err)
      })

    return response
  }

  _buildMessage(method, params) {
    if (typeof method !== 'string') {
      throw new TypeError(method + ' is not a string')
    }

    const message = {
      method,
      jsonrpc: '2.0',
      id: this.id(),
    }

    if (params) Object.assign(message, { params })
    return message
  }

  async batch(calls) {
    const message = calls.map(([method, params]) => {
      return this._buildMessage(method, params)
    })

    await this._send(message)

    return message.map(({ id }) => {
      const { promise } = (this.deferreds[id] = new Deferred())
      return promise
    })
  }

  async call(method, parameters) {
    const message = this._buildMessage(method, parameters)
    await this._send(message)

    const { promise } = (this.deferreds[message.id] = new Deferred())

    return promise
  }

  async _send(message) {
    this.emit('output', message)

    const { socket } = this
    return socket && socket.readyState === 1 ? this.websocket(message) : this.http(message)
  }

  _onresponse({ id, error, result }) {
    const deferred = this.deferreds[id]
    if (!deferred) return
    if (error) deferred.reject(new JSONRPCError(error))
    else deferred.resolve(result)
    delete this.deferreds[id]
  }

  _onrequest({ method, params }) {
    return this.onrequest(method, params)
  }

  _onnotification({ method, params }) {
    this.emit(method, params)
  }

  _onmessage = (message) => {
    this.emit('input', message)

    if (Array.isArray(message)) {
      for (const object of message) {
        this._onobject(object)
      }
    } else {
      this._onobject(message)
    }
  }

  _onobject(message) {
    if (message.method === undefined) this._onresponse(message)
    else if (message.id === undefined) this._onnotification(message)
    else this._onrequest(message)
  }

  async open() {
    const socket = (this.socket = new this.WebSocket(this.url('ws')))

    socket.onclose = (...args) => {
      this.emit('close', ...args)
    }
    socket.onmessage = (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch (err) {
        this.emit('error', err)
        return
      }
      this._onmessage(message)
    }
    socket.onopen = (...args) => {
      this.emit('open', ...args)
    }
    socket.onerror = (...args) => {
      this.emit('error', ...args)
    }

    return promiseEvent(this, 'open')
  }

  async close() {
    const { socket } = this
    socket.close()
    return promiseEvent(this, 'close')
  }

  static defaultOptions = {
    secure: false,
    host: 'localhost',
    port: 80,
    secret: '',
    path: '/jsonrpc',
    fetch: defaultRuntimeFetch,
    WebSocket: defaultRuntimeWebSocket,
  }
}
