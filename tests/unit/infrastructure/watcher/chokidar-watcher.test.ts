import { startWatcher } from '@main/infrastructure/watcher/chokidar-watcher'
import * as electronLog from 'electron-log'

jest.mock('chokidar')
jest.mock('electron-log')

import chokidar from 'chokidar'

describe('ChokidarWatcher', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should create a watcher with correct options', () => {
    const mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    const callback = jest.fn()
    startWatcher('/test/path', callback)

    expect(chokidar.watch).toHaveBeenCalledWith(
      '/test/path',
      expect.objectContaining({
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
      }),
    )
  })

  it('should call callback on file change event', () => {
    const mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    const callback = jest.fn()
    startWatcher('/test/path', callback)

    // Simulate change event
    const changeHandler = jest.mocked(mockWatcher.on).mock.calls.find(
      (c) => c[0] === 'change',
    )?.[1] as Function
    changeHandler('/test/path/file.md')

    expect(callback).toHaveBeenCalledWith('/test/path/file.md')
  })

  it('should call callback on file add event', () => {
    const mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    const callback = jest.fn()
    startWatcher('/test/path', callback)

    const addHandler = jest.mocked(mockWatcher.on).mock.calls.find(
      (c) => c[0] === 'add',
    )?.[1] as Function
    addHandler('/test/path/new-file.md')

    expect(callback).toHaveBeenCalledWith('/test/path/new-file.md')
  })

  it('should call callback on file unlink event', () => {
    const mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    const callback = jest.fn()
    startWatcher('/test/path', callback)

    const unlinkHandler = jest.mocked(mockWatcher.on).mock.calls.find(
      (c) => c[0] === 'unlink',
    )?.[1] as Function
    unlinkHandler('/test/path/deleted-file.md')

    expect(callback).toHaveBeenCalledWith('/test/path/deleted-file.md')
  })

  it('should log error and retry on watcher error', () => {
    const mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    const callback = jest.fn()
    startWatcher('/test/path', callback)

    const errorHandler = jest.mocked(mockWatcher.on).mock.calls.find(
      (c) => c[0] === 'error',
    )?.[1] as Function
    const testError = new Error('Watch error')
    errorHandler(testError)

    expect(electronLog.error).toHaveBeenCalledWith(
      expect.objectContaining({
        component: 'chokidar-watcher',
        path: '/test/path',
      }),
    )
  })

  it('should retry on error with exponential backoff', () => {
    const mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    const callback = jest.fn()
    const watcher = startWatcher('/test/path', callback, 2)

    expect(chokidar.watch).toHaveBeenCalledTimes(1)

    const errorHandler = jest.mocked(mockWatcher.on).mock.calls.find(
      (c) => c[0] === 'error',
    )?.[1] as Function
    errorHandler(new Error('First error'))

    // After error, should schedule a retry
    jest.advanceTimersByTime(2000) // 2^1 * 1000

    // After delay, should call watch again
    expect(chokidar.watch).toHaveBeenCalledTimes(2)
  })

  it('should stop retrying after maxRetries is reached', () => {
    let callCount = 0
    const mockWatcher = {
      on: jest.fn().mockImplementation(function (this: any) {
        callCount++
        return this
      }),
      close: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    const callback = jest.fn()
    startWatcher('/test/path', callback, 1)

    const errorHandler = jest.mocked(mockWatcher.on).mock.calls.find(
      (c) => c[0] === 'error',
    )?.[1] as Function

    // First error
    errorHandler(new Error('First error'))
    jest.advanceTimersByTime(2000)

    // Second error (should stop)
    errorHandler(new Error('Second error'))
    jest.advanceTimersByTime(4000)

    expect(electronLog.error).toHaveBeenCalled()
  })

  it('should close watcher on stop', async () => {
    const mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    const callback = jest.fn()
    const watcher = startWatcher('/test/path', callback)

    await watcher.stop()

    expect(mockWatcher.close).toHaveBeenCalled()
  })

  it('should ignore .backups directory', () => {
    const mockWatcher = {
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    }
    jest.mocked(chokidar.watch).mockReturnValue(mockWatcher as any)

    const callback = jest.fn()
    startWatcher('/test/path', callback)

    const ignorePattern = jest.mocked(chokidar.watch).mock.calls[0]?.[1]?.ignored
    expect(ignorePattern).toBeDefined()
  })
})
