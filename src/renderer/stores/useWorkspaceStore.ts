import { create } from 'zustand'
import type { IpcClaudeFolder, IpcAuthState } from '../../shared/ipc-channels'

interface WorkspaceState {
  projects: IpcClaudeFolder[]
  authState: IpcAuthState | null
  isAuthValid: boolean
  setProjects: (projects: IpcClaudeFolder[]) => void
  addProject: (project: IpcClaudeFolder) => void
  setAuthState: (auth: IpcAuthState) => void
  setAuthValid: (valid: boolean) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  projects: [],
  authState: null,
  isAuthValid: false,
  setProjects: (projects) => set({ projects }),
  addProject: (project) =>
    set((state) => ({
      projects: state.projects.some((p) => p.claudePath === project.claudePath)
        ? state.projects
        : [...state.projects, project],
    })),
  setAuthState: (auth) => set({ authState: auth, isAuthValid: auth.isValid }),
  setAuthValid: (valid) =>
    set((state) => ({
      isAuthValid: valid,
      authState: state.authState ? { ...state.authState, isValid: valid } : null,
    })),
}))
