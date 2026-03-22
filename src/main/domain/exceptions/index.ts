export class DomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'DomainError'
  }
}

export class BackupFailedError extends DomainError {
  constructor(filePath: string, cause: string) {
    super('BACKUP_FAILED', `Backup failed for "${filePath}": ${cause}`)
  }
}

export class PathTraversalError extends DomainError {
  constructor(inputPath: string) {
    super(
      'PATH_TRAVERSAL',
      `Path "${inputPath}" escapes the allowed base directory`,
    )
  }
}

export class SectionRequiredError extends DomainError {
  constructor(sectionHeading: string) {
    super(
      'SECTION_REQUIRED',
      `Section "## ${sectionHeading}" is required and cannot be deleted`,
    )
  }
}

export class InvalidFrontmatterError extends DomainError {
  constructor(filePath: string, detail: string) {
    super(
      'INVALID_FRONTMATTER',
      `Invalid frontmatter in "${filePath}": ${detail}`,
    )
  }
}

export class CircuitOpenError extends DomainError {
  constructor() {
    super('CIRCUIT_OPEN', 'Claude API circuit breaker is OPEN — calls rejected')
  }
}

export class AuthInvalidError extends DomainError {
  constructor(code: 'AUTH_MISSING' | 'AUTH_INVALID' | 'AUTH_NETWORK_ERROR') {
    super(code, `Authentication error: ${code}`)
  }
}

export class McpConfigValidationError extends DomainError {
  constructor(
    public readonly fields: Array<{ field: string; message: string }>,
  ) {
    super(
      'MCP_CONFIG_INVALID',
      `MCP config validation failed: ${fields.map((f) => f.field).join(', ')}`,
    )
  }
}
