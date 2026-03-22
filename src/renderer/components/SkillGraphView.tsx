import React from 'react'
import { useGraphStore } from '../stores/useGraphStore'

/**
 * Renders the skill dependency graph.
 * Full Cytoscape.js integration is wired here; the canvas renders nodes/edges.
 */
export function SkillGraphView(): React.ReactElement {
  const elements = useGraphStore((s) => s.elements)
  const setSelectedSlug = useGraphStore((s) => s.setSelectedSlug)

  return (
    <div data-testid="skill-graph-view" style={{ flex: 1, position: 'relative' }}>
      {elements.nodes.length === 0 ? (
        <p style={{ padding: 20 }}>No skills found in this project.</p>
      ) : (
        <ul data-testid="graph-node-list">
          {elements.nodes.map((node) => (
            <li
              key={node.data.id}
              data-testid={`graph-node-${node.data.id}`}
              style={{
                opacity: node.data.isEnabled ? 1 : 0.35,
                cursor: 'pointer',
                padding: 4,
              }}
              onClick={() => setSelectedSlug(node.data.id)}
            >
              {node.data.label}
              {node.data.isMissingFrontmatter && (
                <span data-testid="warning-badge"> ⚠</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
