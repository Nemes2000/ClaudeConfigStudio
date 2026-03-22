import React, { useState } from 'react'
import { useIpc } from '../hooks/useIpc'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { AuthValidateResponse } from '../../shared/ipc-channels'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

export function OnboardingWizard(): React.ReactElement {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const ipc = useIpc()
  const authState = useWorkspaceStore((s) => s.authState)
  const networkError =
    authState?.keyPresent && !authState?.isValid && !error

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    if (!apiKey.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await ipc.invoke<AuthValidateResponse>(IPC_CHANNELS.AUTH_VALIDATE, {
        apiKey: apiKey.trim(),
      })
      if (!res.ok) {
        setError(res.message ?? 'Invalid API key — check your Anthropic dashboard')
      }
    } catch {
      setError('Unexpected error validating key')
    } finally {
      setIsLoading(false)
      setApiKey('')
    }
  }

  async function handleRetry(): Promise<void> {
    setIsLoading(true)
    try {
      await ipc.invoke(IPC_CHANNELS.AUTH_VALIDATE, {})
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div data-testid="onboarding-wizard" style={{ padding: 40, maxWidth: 480 }}>
      <h2>Connect to Claude API</h2>
      <p>Enter your Anthropic API key to enable AI features.</p>
      {networkError && (
        <div data-testid="network-error-banner">
          Unable to reach Claude API — check your connection.
          <button onClick={handleRetry} disabled={isLoading}>
            Retry
          </button>
        </div>
      )}
      <form onSubmit={handleSubmit}>
        <input
          data-testid="api-key-input"
          type="password"
          placeholder="sk-ant-..."
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          disabled={isLoading}
          style={{ width: '100%', padding: 8, marginBottom: 8 }}
        />
        {error && (
          <p data-testid="error-message" style={{ color: 'red' }}>
            {error}
          </p>
        )}
        <button
          data-testid="submit-button"
          type="submit"
          disabled={isLoading || !apiKey.trim()}
        >
          {isLoading ? 'Validating…' : 'Save API Key'}
        </button>
      </form>
    </div>
  )
}
