import React from 'react'
import { useSuggestionStore } from '../stores/useSuggestionStore'

const SEVERITY_COLOR: Record<string, string> = {
  info: '#0070f3',
  warning: '#f5a623',
  error: '#e00',
}

export function SuggestionSidebar(): React.ReactElement {
  const suggestions = useSuggestionStore((s) => s.suggestions)
  const isLoading = useSuggestionStore((s) => s.isLoading)

  return (
    <div data-testid="suggestion-sidebar" style={{ width: 280, padding: 12, borderLeft: '1px solid #eee' }}>
      <h3>Suggestions</h3>
      {isLoading && <p data-testid="loading-indicator">Analyzing…</p>}
      {!isLoading && suggestions.length === 0 && (
        <p data-testid="no-suggestions">No suggestions for this skill.</p>
      )}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {suggestions.map((s, idx) => (
          <li
            key={idx}
            data-testid={`suggestion-${idx}`}
            style={{ marginBottom: 12, borderLeft: `3px solid ${SEVERITY_COLOR[s.severity] ?? '#999'}`, paddingLeft: 8 }}
          >
            <strong>{s.title}</strong>
            <p style={{ margin: '4px 0', fontSize: 12 }}>{s.description}</p>
            <span style={{ fontSize: 10, color: '#666' }}>{s.affectedSection}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
