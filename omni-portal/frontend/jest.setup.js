import '@testing-library/jest-dom'
import 'jest-axe/extend-expect'

// Polyfill fetch for test environment (required for MSW and API calls)
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Fetch polyfill for Node.js test environment
global.fetch = require('node-fetch')

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
delete window.location
window.location = { 
  pathname: '/',
  href: 'http://localhost:3000',
  origin: 'http://localhost:3000',
  reload: jest.fn(),
}

// Mock act for async operations
global.act = require('react').act

// Add TextEncoder/TextDecoder for MSW
const { TextEncoder, TextDecoder } = require('util')
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

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