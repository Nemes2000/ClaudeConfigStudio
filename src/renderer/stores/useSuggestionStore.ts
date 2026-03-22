import { create } from 'zustand'
import type { IpcSuggestion } from '../../shared/ipc-channels'

interface SuggestionState {
  suggestions: IpcSuggestion[]
  isLoading: boolean
  rateLimitedUntil: Date | null
  setSuggestions: (suggestions: IpcSuggestion[]) => void
  setLoading: (loading: boolean) => void
  setRateLimited: (until: Date | null) => void
}

export const useSuggestionStore = create<SuggestionState>((set) => ({
  suggestions: [],
  isLoading: false,
  rateLimitedUntil: null,
  setSuggestions: (suggestions) => set({ suggestions }),
  setLoading: (isLoading) => set({ isLoading }),
  setRateLimited: (rateLimitedUntil) => set({ rateLimitedUntil }),
}))
