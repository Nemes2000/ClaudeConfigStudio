import { CircuitBreaker } from '../../../src/main/infrastructure/http/anthropic-client'

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker

  beforeEach(() => {
    cb = new CircuitBreaker()
  })

  it('starts in CLOSED state', () => {
    expect(cb.state).toBe('CLOSED')
  })

  it('remains CLOSED after fewer than 5 failures', () => {
    for (let i = 0; i < 4; i++) cb.recordFailure()
    expect(cb.state).toBe('CLOSED')
  })

  it('opens after 5 consecutive failures', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure()
    expect(cb.state).toBe('OPEN')
  })

  it('resets to CLOSED on success', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure()
    cb.recordSuccess()
    expect(cb.state).toBe('CLOSED')
  })

  it('check() does not throw when CLOSED', () => {
    expect(() => cb.check()).not.toThrow()
  })

  it('check() throws when OPEN', () => {
    for (let i = 0; i < 5; i++) cb.recordFailure()
    expect(() => cb.check()).toThrow()
  })

  it('calls onStateChange when transitioning to OPEN', () => {
    const onChange = jest.fn()
    cb.setOnStateChange(onChange)
    for (let i = 0; i < 5; i++) cb.recordFailure()
    expect(onChange).toHaveBeenCalledWith('OPEN')
  })

  it('calls onStateChange when transitioning back to CLOSED', () => {
    const onChange = jest.fn()
    cb.setOnStateChange(onChange)
    for (let i = 0; i < 5; i++) cb.recordFailure()
    cb.recordSuccess()
    expect(onChange).toHaveBeenCalledWith('CLOSED')
  })
})
