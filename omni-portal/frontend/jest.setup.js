import '@testing-library/jest-dom'
import 'jest-axe/extend-expect'
// Polyfill fetch and text encoding for test environment (required for MSW and API calls)
const { TextEncoder, TextDecoder } = require('util')

// Use whatwg-fetch polyfill for Jest environment
require('whatwg-fetch')

global.TextEncoder = TextEncoder  
global.TextDecoder = TextDecoder

// Polyfill for Node.js stream APIs in jsdom
global.TransformStream = global.TransformStream || class {
  constructor() {
    this.readable = { getReader: () => ({ read: () => Promise.resolve({ done: true }) }) }
    this.writable = { getWriter: () => ({ write: () => Promise.resolve(), close: () => Promise.resolve() }) }
  }
}

global.CompressionStream = global.CompressionStream || class {
  constructor() {
    this.readable = { getReader: () => ({ read: () => Promise.resolve({ done: true }) }) }
    this.writable = { getWriter: () => ({ write: () => Promise.resolve(), close: () => Promise.resolve() }) }
  }
}

global.DecompressionStream = global.DecompressionStream || class {
  constructor() {
    this.readable = { getReader: () => ({ read: () => Promise.resolve({ done: true }) }) }
    this.writable = { getWriter: () => ({ write: () => Promise.resolve(), close: () => Promise.resolve() }) }
  }
}

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

// Mock BroadcastChannel
global.BroadcastChannel = class BroadcastChannel {
  constructor(name) {
    this.name = name
    this.listeners = []
  }
  postMessage(message) {
    this.listeners.forEach(listener => {
      listener({ data: message })
    })
  }
  addEventListener(event, callback) {
    if (event === 'message') {
      this.listeners.push(callback)
    }
  }
  removeEventListener(event, callback) {
    if (event === 'message') {
      this.listeners = this.listeners.filter(l => l !== callback)
    }
  }
  close() {
    this.listeners = []
  }
}

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

// Add polyfills for MSW
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      this.url = input
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this.body = init?.body
    }
  }
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body
      this.status = init?.status || 200
      this.statusText = init?.statusText || ''
      this.headers = new Map(Object.entries(init?.headers || {}))
      this.ok = this.status >= 200 && this.status < 300
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }
    
    async text() {
      return typeof this.body === 'string' ? this.body : JSON.stringify(this.body)
    }
  }
}

if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers extends Map {
    constructor(init) {
      super()
      if (init) {
        Object.entries(init).forEach(([key, value]) => {
          this.set(key.toLowerCase(), value)
        })
      }
    }
    
    get(name) {
      return super.get(name.toLowerCase())
    }
    
    set(name, value) {
      return super.set(name.toLowerCase(), value)
    }
  }
}

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