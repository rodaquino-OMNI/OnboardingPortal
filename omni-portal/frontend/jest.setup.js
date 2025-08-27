// Critical: Polyfills must be loaded FIRST before any MSW code
// Install fetch polyfill with all required globals
require('whatwg-fetch')

// Install critical Node.js polyfills for MSW v2
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Stream API polyfills (required by MSW v2 interceptors)
if (!global.TransformStream) {
  global.TransformStream = class TransformStream {
    constructor(transformer = {}) {
      this.readable = {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: undefined })
        })
      }
      this.writable = {
        getWriter: () => ({
          write: (chunk) => Promise.resolve(),
          close: () => Promise.resolve()
        })
      }
    }
  }
}

if (!global.CompressionStream) {
  global.CompressionStream = class CompressionStream {
    constructor(format) {
      this.readable = {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: undefined })
        })
      }
      this.writable = {
        getWriter: () => ({
          write: (chunk) => Promise.resolve(),
          close: () => Promise.resolve()
        })
      }
    }
  }
}

if (!global.DecompressionStream) {
  global.DecompressionStream = class DecompressionStream {
    constructor(format) {
      this.readable = {
        getReader: () => ({
          read: () => Promise.resolve({ done: true, value: undefined })
        })
      }
      this.writable = {
        getWriter: () => ({
          write: (chunk) => Promise.resolve(),
          close: () => Promise.resolve()
        })
      }
    }
  }
}

// ReadableStream polyfill
if (!global.ReadableStream) {
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource = {}, strategy = {}) {
      this._reader = null
    }
    
    getReader() {
      if (this._reader) throw new Error('ReadableStream is already locked to a reader')
      this._reader = {
        read: () => Promise.resolve({ done: true, value: undefined }),
        releaseLock: () => { this._reader = null }
      }
      return this._reader
    }
  }
}

// BroadcastChannel polyfill (required for MSW WebSocket support)
if (!global.BroadcastChannel) {
  global.BroadcastChannel = class BroadcastChannel {
    constructor(name) {
      this.name = name
      this._listeners = new Map()
    }
    
    postMessage(message) {
      // In test environment, we can simulate broadcasting
      const messageEvent = { data: message, type: 'message' }
      this._listeners.get('message')?.forEach(callback => {
        setTimeout(() => callback(messageEvent), 0)
      })
    }
    
    addEventListener(type, listener) {
      if (!this._listeners.has(type)) {
        this._listeners.set(type, new Set())
      }
      this._listeners.get(type).add(listener)
    }
    
    removeEventListener(type, listener) {
      this._listeners.get(type)?.delete(listener)
    }
    
    close() {
      this._listeners.clear()
    }
  }
}

// Install Fetch API polyfills for MSW
if (!global.Request) {
  global.Request = globalThis.Request || class Request {
    constructor(input, init = {}) {
      this.url = typeof input === 'string' ? input : input.url || ''
      this.method = init.method || 'GET'
      this.headers = new Headers(init.headers)
      this.body = init.body
      this.mode = init.mode || 'cors'
      this.credentials = init.credentials || 'same-origin'
    }
    
    clone() {
      return new Request(this.url, {
        method: this.method,
        headers: this.headers,
        body: this.body,
        mode: this.mode,
        credentials: this.credentials
      })
    }
    
    async json() {
      return JSON.parse(this.body || '{}')
    }
    
    async text() {
      return String(this.body || '')
    }
  }
}

if (!global.Response) {
  global.Response = globalThis.Response || class Response {
    constructor(body, init = {}) {
      this.body = body
      this.status = init.status || 200
      this.statusText = init.statusText || 'OK'
      this.headers = new Headers(init.headers)
      this.ok = this.status >= 200 && this.status < 300
      this.redirected = false
      this.type = 'basic'
      this.url = ''
    }
    
    clone() {
      return new Response(this.body, {
        status: this.status,
        statusText: this.statusText,
        headers: this.headers
      })
    }
    
    static json(data, init = {}) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...init.headers
        }
      })
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }
    
    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
    }
    
    async arrayBuffer() {
      const text = await this.text()
      return new TextEncoder().encode(text).buffer
    }
  }
}

if (!global.Headers) {
  global.Headers = globalThis.Headers || class Headers {
    constructor(init = {}) {
      this._headers = new Map()
      if (init) {
        if (init instanceof Headers) {
          init.forEach((value, key) => this.set(key, value))
        } else if (Array.isArray(init)) {
          init.forEach(([key, value]) => this.set(key, value))
        } else {
          Object.entries(init).forEach(([key, value]) => this.set(key, value))
        }
      }
    }
    
    append(name, value) {
      const existing = this.get(name)
      this.set(name, existing ? `${existing}, ${value}` : value)
    }
    
    delete(name) {
      this._headers.delete(name.toLowerCase())
    }
    
    get(name) {
      return this._headers.get(name.toLowerCase()) || null
    }
    
    has(name) {
      return this._headers.has(name.toLowerCase())
    }
    
    set(name, value) {
      this._headers.set(name.toLowerCase(), String(value))
    }
    
    forEach(callback, thisArg) {
      this._headers.forEach((value, key) => {
        callback.call(thisArg, value, key, this)
      })
    }
    
    keys() {
      return this._headers.keys()
    }
    
    values() {
      return this._headers.values()
    }
    
    entries() {
      return this._headers.entries()
    }
    
    [Symbol.iterator]() {
      return this.entries()
    }
  }
}

// Now load testing libraries
require('@testing-library/jest-dom')
require('jest-axe/extend-expect')

// Setup MSW for API mocking (after polyfills)
const { startServer, stopServer, resetHandlers } = require('./__tests__/setup/api-mocks')

// Start server before all tests
beforeAll(() => {
  startServer()
})

// Reset handlers after each test
afterEach(() => {
  resetHandlers()
})

// Stop server after all tests
afterAll(() => {
  stopServer()
})
// Polyfills already installed above

// Stream polyfills already installed above

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock ResizeObserver  
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock HTMLCanvasElement.getContext for jsPDF and other canvas operations
HTMLCanvasElement.prototype.getContext = jest.fn(() => {
  return {
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    globalCompositeOperation: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    miterLimit: 10,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    shadowBlur: 0,
    shadowColor: '',
    save: jest.fn(),
    restore: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    translate: jest.fn(),
    transform: jest.fn(),
    setTransform: jest.fn(),
    createLinearGradient: jest.fn(),
    createRadialGradient: jest.fn(),
    createPattern: jest.fn(),
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    strokeRect: jest.fn(),
    beginPath: jest.fn(),
    closePath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    quadraticCurveTo: jest.fn(),
    bezierCurveTo: jest.fn(),
    arcTo: jest.fn(),
    rect: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    clip: jest.fn(),
    isPointInPath: jest.fn(),
    drawImage: jest.fn(),
    fillText: jest.fn(),
    strokeText: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    createImageData: jest.fn(),
    getImageData: jest.fn(() => ({ data: [] })),
    putImageData: jest.fn(),
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock performance.now
global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now()),
}

// BroadcastChannel already polyfilled above

// Mock window.location
const mockLocation = {
  pathname: '/',
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  reload: jest.fn(),
  assign: jest.fn(),
  replace: jest.fn(),
}

// Only try to delete and redefine if it doesn't already exist as a mock
if (!window.location.reload || typeof window.location.reload !== 'function') {
  delete window.location
  window.location = mockLocation
}

// Mock act for async operations
global.act = require('react').act

// TextEncoder/TextDecoder already defined above

// Polyfills already installed above - this section is redundant

// Mock console.error to filter out React act() warnings in tests
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' && 
      args[0].includes('Warning: An update to')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});