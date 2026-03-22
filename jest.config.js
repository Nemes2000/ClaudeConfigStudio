/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@main/(.*)$': '<rootDir>/src/main/$1',
    // electron-log writes to platform-specific paths at import time;
    // mock it globally so unit tests work without Electron context on all platforms.
    '^electron-log$': '<rootDir>/tests/unit/__mocks__/electron-log.js',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
  collectCoverageFrom: [
    'src/main/**/*.ts',
    '!src/main/index.ts',
    '!src/main/ipc/**',
  ],
  coverageThreshold: {
    global: {
      lines: 80,
    },
  },
}
