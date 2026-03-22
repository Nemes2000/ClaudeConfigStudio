import { create } from 'zustand'

interface EditorState {
  filePath: string | null
  content: string
  isDirty: boolean
  setFile: (filePath: string, content: string) => void
  setContent: (content: string) => void
  markClean: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  filePath: null,
  content: '',
  isDirty: false,
  setFile: (filePath, content) => set({ filePath, content, isDirty: false }),
  setContent: (content) => set({ content, isDirty: true }),
  markClean: () => set({ isDirty: false }),
}))
