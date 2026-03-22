import {
  enableMcpInstallation,
  disableMcpInstallation,
  type McpInstallation,
} from '../../../src/main/domain/models/mcp'

describe('enableMcpInstallation', () => {
  it('returns installation with isEnabled set to true', () => {
    const installation: McpInstallation = {
      moduleName: 'my-mcp',
      configFilePath: '/path/to/config.yaml',
      isEnabled: false,
      hasAuthKey: true,
      config: { apiKey: 'secret' },
    }

    const result = enableMcpInstallation(installation)

    expect(result.isEnabled).toBe(true)
  })

  it('preserves other properties when enabling', () => {
    const installation: McpInstallation = {
      moduleName: 'my-mcp',
      configFilePath: '/path/to/config.yaml',
      isEnabled: false,
      hasAuthKey: true,
      config: { apiKey: 'secret' },
    }

    const result = enableMcpInstallation(installation)

    expect(result.moduleName).toBe('my-mcp')
    expect(result.configFilePath).toBe('/path/to/config.yaml')
    expect(result.hasAuthKey).toBe(true)
    expect(result.config).toEqual({ apiKey: 'secret' })
  })

  it('returns a new object', () => {
    const installation: McpInstallation = {
      moduleName: 'my-mcp',
      configFilePath: '/path/to/config.yaml',
      isEnabled: false,
      hasAuthKey: false,
      config: {},
    }

    const result = enableMcpInstallation(installation)

    expect(result).not.toBe(installation)
  })

  it('works when already enabled', () => {
    const installation: McpInstallation = {
      moduleName: 'my-mcp',
      configFilePath: '/path/to/config.yaml',
      isEnabled: true,
      hasAuthKey: false,
      config: {},
    }

    const result = enableMcpInstallation(installation)

    expect(result.isEnabled).toBe(true)
  })
})

describe('disableMcpInstallation', () => {
  it('returns installation with isEnabled set to false', () => {
    const installation: McpInstallation = {
      moduleName: 'my-mcp',
      configFilePath: '/path/to/config.yaml',
      isEnabled: true,
      hasAuthKey: true,
      config: { apiKey: 'secret' },
    }

    const result = disableMcpInstallation(installation)

    expect(result.isEnabled).toBe(false)
  })

  it('preserves other properties when disabling', () => {
    const installation: McpInstallation = {
      moduleName: 'my-mcp',
      configFilePath: '/path/to/config.yaml',
      isEnabled: true,
      hasAuthKey: true,
      config: { apiKey: 'secret' },
    }

    const result = disableMcpInstallation(installation)

    expect(result.moduleName).toBe('my-mcp')
    expect(result.configFilePath).toBe('/path/to/config.yaml')
    expect(result.hasAuthKey).toBe(true)
    expect(result.config).toEqual({ apiKey: 'secret' })
  })

  it('returns a new object', () => {
    const installation: McpInstallation = {
      moduleName: 'my-mcp',
      configFilePath: '/path/to/config.yaml',
      isEnabled: true,
      hasAuthKey: false,
      config: {},
    }

    const result = disableMcpInstallation(installation)

    expect(result).not.toBe(installation)
  })

  it('works when already disabled', () => {
    const installation: McpInstallation = {
      moduleName: 'my-mcp',
      configFilePath: '/path/to/config.yaml',
      isEnabled: false,
      hasAuthKey: false,
      config: {},
    }

    const result = disableMcpInstallation(installation)

    expect(result.isEnabled).toBe(false)
  })
})
