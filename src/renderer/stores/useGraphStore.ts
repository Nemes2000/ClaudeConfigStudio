import { create } from 'zustand'
import type { IpcCytoscapeElements } from '../../shared/ipc-channels'

interface GraphState {
  elements: IpcCytoscapeElements
  selectedSlug: string | null
  setElements: (elements: IpcCytoscapeElements) => void
  setSelectedSlug: (slug: string | null) => void
}

export const useGraphStore = create<GraphState>((set) => ({
  elements: { nodes: [], edges: [] },
  selectedSlug: null,
  setElements: (elements) => set({ elements }),
  setSelectedSlug: (selectedSlug) => set({ selectedSlug }),
}))
