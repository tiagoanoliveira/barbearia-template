import '@testing-library/jest-dom'

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)
