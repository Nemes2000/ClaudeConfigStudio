import React, { useEffect } from 'react'
import { useIpc, useIpcListener } from '../hooks/useIpc'
import { IPC_CHANNELS } from '../../shared/ipc-channels'
import type { IpcClaudeFolder, IpcCytoscapeElements, IpcAuthState } from '../../shared/ipc-channels'
import { useWorkspaceStore } from '../stores/useWorkspaceStore'
import { useGraphStore } from '../stores/useGraphStore'
import { useSuggestionStore } from '../stores/useSuggestionStore'
import { SkillGraphView } from '../components/SkillGraphView'
import { SuggestionSidebar } from '../components/SuggestionSidebar'
import { OnboardingWizard } from '../components/OnboardingWizard'

export function WorkspacePage(): React.ReactElement {
  const ipc = useIpc()
  const addProject = useWorkspaceStore((s) => s.addProject)
  const setAuthState = useWorkspaceStore((s) => s.setAuthState)
  const isAuthValid = useWorkspaceStore((s) => s.isAuthValid)
  const setElements = useGraphStore((s) => s.setElements)
  const setSuggestions = useSuggestionStore((s) => s.setSuggestions)

  // Push event: project discovered → add to workspace, update graph
  useIpcListener(IPC_CHANNELS.PROJECT_DISCOVERED, (payload) => {
    const { folder, cytoscapeElements } = payload as {
      folder: IpcClaudeFolder
      cytoscapeElements: IpcCytoscapeElements
    }
    addProject(folder)
    setElements(cytoscapeElements)
  })

  // Push event: graph updated (after file write/rollback)
  useIpcListener(IPC_CHANNELS.GRAPH_UPDATED, (payload) => {
    const { cytoscapeElements } = payload as { cytoscapeElements: IpcCytoscapeElements }
    setElements(cytoscapeElements)
  })

  // Push event: auth state changed
  useIpcListener(IPC_CHANNELS.AUTH_STATE_CHANGED, (payload) => {
    setAuthState(payload as IpcAuthState)
  })

  // Push event: suggestions ready
  useIpcListener(IPC_CHANNELS.SUGGESTION_READY, (payload) => {
    setSuggestions(payload as Parameters<typeof setSuggestions>[0])
  })

  // Trigger workspace scan on mount
  useEffect(() => {
    void ipc.invoke(IPC_CHANNELS.PROJECT_SCAN, { workspaceFolders: [] })
  }, [ipc])

  if (!isAuthValid) {
    return <OnboardingWizard />
  }

  return (
    <div
      data-testid="workspace-page"
      style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}
    >
      <SkillGraphView />
      <SuggestionSidebar />
    </div>
  )
}
