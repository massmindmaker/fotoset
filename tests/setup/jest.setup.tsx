/**
 * Jest Setup for Unit Tests
 *
 * Configures testing environment, mocks, and global utilities
 */

import '@testing-library/jest-dom';

// Polyfills for Next.js API route testing (Request/Response)
import { TextEncoder, TextDecoder } from 'util';

// Set up Web API globals for Next.js server components
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// Add Web Streams API if available
try {
  const { ReadableStream, TransformStream, WritableStream } = require('stream/web');
  global.ReadableStream = ReadableStream;
  global.TransformStream = TransformStream;
  global.WritableStream = WritableStream;
} catch {
  // stream/web may not be available in all Node versions
}

// Add MessageChannel for undici
if (typeof MessageChannel === 'undefined') {
  const { MessageChannel } = require('worker_threads');
  (global as any).MessageChannel = MessageChannel;
}

// Add MessagePort for undici
if (typeof MessagePort === 'undefined') {
  const { MessagePort } = require('worker_threads');
  (global as any).MessagePort = MessagePort;
}

// Request and Response polyfills from undici (Node.js built-in)
try {
  const { Request, Response, Headers, FormData, Blob } = require('undici');
  global.Request = Request;
  global.Response = Response;
  global.Headers = Headers;
  global.FormData = FormData;
  global.Blob = Blob;
} catch (err) {
  // undici not available, check if globals exist from Node.js 18+
  if (typeof Request === 'undefined') {
    console.warn('Warning: Request polyfill not available');
  }
}

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Next.js Image component
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...props} />;
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

global.localStorage = localStorageMock as Storage;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

global.sessionStorage = sessionStorageMock as Storage;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock fetch for API calls
global.fetch = jest.fn();

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
});

// Cleanup after each test
afterEach(() => {
  jest.restoreAllMocks();
});

// Suppress console errors in tests (optional)
// const originalError = console.error;
// beforeAll(() => {
//   console.error = jest.fn();
// });
// afterAll(() => {
//   console.error = originalError;
// });
