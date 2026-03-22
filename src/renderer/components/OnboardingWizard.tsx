import React, { useState } from 'react'
import { useIpc } from '../hooks/useIpc'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { AuthValidateResponse, AuthSignInWithClaudeResponse } from '../../shared/ipc-channels'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'

export function OnboardingWizard(): React.ReactElement {
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSigningInWithClaude, setIsSigningInWithClaude] = useState(false)
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

  async function handleSignInWithClaude(): Promise<void> {
    setIsSigningInWithClaude(true)
    setError(null)
    try {
      const res = await ipc.invoke<AuthSignInWithClaudeResponse>(
        IPC_CHANNELS.AUTH_SIGN_IN_WITH_CLAUDE,
        {},
      )
      if (!res.ok && res.reason !== 'cancelled') {
        setError(res.message ?? 'Sign in with Claude account failed')
      }
    } catch {
      setError('Unexpected error during Claude account sign-in')
    } finally {
      setIsSigningInWithClaude(false)
    }
  }

  return (
    <div data-testid="onboarding-wizard" style={{ padding: 40, maxWidth: 480 }}>
      <h2>Connect to Claude</h2>
      <p>Sign in with your Claude account or enter an API key.</p>
      {networkError && (
        <div data-testid="network-error-banner">
          Unable to reach Claude API — check your connection.
          <button onClick={handleRetry} disabled={isLoading}>
            Retry
          </button>
        </div>
      )}
      <button
        data-testid="sign-in-with-claude-button"
        onClick={handleSignInWithClaude}
        disabled={isLoading || isSigningInWithClaude}
        style={{
          width: '100%',
          padding: 10,
          marginBottom: 16,
          backgroundColor: '#1a1a1a',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          fontSize: 14,
          cursor: isLoading || isSigningInWithClaude ? 'not-allowed' : 'pointer',
          opacity: isLoading || isSigningInWithClaude ? 0.6 : 1,
        }}
      >
        {isSigningInWithClaude ? 'Opening browser…' : 'Sign in with Claude account'}
      </button>
      <div style={{ textAlign: 'center', marginBottom: 16, color: '#666' }}>— or —</div>
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
