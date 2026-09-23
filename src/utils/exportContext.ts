const EXPORT_CONTEXT_KEY = 'wdm.v1.exportContext'

export type ExportContext = {
  filteredIds: string[]
  selectedIds: string[]
  updatedAt: string
}

export function saveExportContext(filteredIds: string[], selectedIds: string[]): void {
  const payload: ExportContext = {
    filteredIds,
    selectedIds,
    updatedAt: new Date().toISOString(),
  }
  try {
    sessionStorage.setItem(EXPORT_CONTEXT_KEY, JSON.stringify(payload))
  } catch {
    // ignore quota / privacy mode failures
  }
}

export function loadExportContext(): ExportContext {
  try {
    const raw = sessionStorage.getItem(EXPORT_CONTEXT_KEY)
    if (!raw) return { filteredIds: [], selectedIds: [], updatedAt: '' }
    const parsed = JSON.parse(raw) as ExportContext
    return {
      filteredIds: Array.isArray(parsed.filteredIds) ? parsed.filteredIds : [],
      selectedIds: Array.isArray(parsed.selectedIds) ? parsed.selectedIds : [],
      updatedAt: parsed.updatedAt || '',
    }
  } catch {
    return { filteredIds: [], selectedIds: [], updatedAt: '' }
  }
}
