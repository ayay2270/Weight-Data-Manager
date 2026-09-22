import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AppData, AppSettings, Project, WeightRecord } from '../data/types'
import { normalizeWeightRecord, nowIso, uid } from '../utils/helpers'
import { clearAppData, loadAppData, loadSeed, normalizeAppData, saveAppData } from '../utils/storage'

interface DataContextValue {
  data: AppData
  projects: Project[]
  records: WeightRecord[]
  settings: AppSettings
  replaceData: (next: AppData) => void
  upsertProject: (project: Project) => void
  deleteProject: (id: string) => void
  upsertRecord: (record: WeightRecord) => void
  deleteRecord: (id: string) => void
  duplicateRecord: (id: string) => void
  updateSettings: (patch: Partial<AppSettings>) => void
  resetDemoData: () => void
  getProjectRecords: (projectId: string) => WeightRecord[]
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadAppData())

  useEffect(() => {
    saveAppData(data)
  }, [data])

  const replaceData = useCallback((next: AppData) => {
    const normalized = normalizeAppData(next)
    setData({ ...normalized, settings: { ...normalized.settings, lastUpdated: nowIso() } })
  }, [])

  const upsertProject = useCallback((project: Project) => {
    setData((prev) => {
      const exists = prev.projects.some((p) => p.id === project.id)
      const projects = exists
        ? prev.projects.map((p) => (p.id === project.id ? { ...project, updatedAt: nowIso() } : p))
        : [...prev.projects, { ...project, createdAt: project.createdAt || nowIso(), updatedAt: nowIso() }]
      return { ...prev, projects, settings: { ...prev.settings, lastUpdated: nowIso() } }
    })
  }, [])

  const deleteProject = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
      records: prev.records.filter((r) => r.projectId !== id),
      settings: {
        ...prev.settings,
        defaultProjectId: prev.settings.defaultProjectId === id ? null : prev.settings.defaultProjectId,
        lastUpdated: nowIso(),
      },
    }))
  }, [])

  const upsertRecord = useCallback((record: WeightRecord) => {
    setData((prev) => {
      const stamp = nowIso()
      const normalized: WeightRecord = {
        ...normalizeWeightRecord(record),
        updatedAt: stamp,
        createdAt: record.createdAt || stamp,
      }
      const exists = prev.records.some((r) => r.id === normalized.id)
      const records = exists
        ? prev.records.map((r) => (r.id === normalized.id ? normalized : r))
        : [...prev.records, normalized]
      return { ...prev, records, settings: { ...prev.settings, lastUpdated: stamp } }
    })
  }, [])

  const deleteRecord = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      records: prev.records.filter((r) => r.id !== id),
      settings: { ...prev.settings, lastUpdated: nowIso() },
    }))
  }, [])

  const duplicateRecord = useCallback((id: string) => {
    setData((prev) => {
      const src = prev.records.find((r) => r.id === id)
      if (!src) return prev
      const stamp = nowIso()
      const copy: WeightRecord = {
        ...normalizeWeightRecord(src),
        id: uid('rec'),
        description: `${src.description} (copy)`,
        status: 'Draft',
        createdAt: stamp,
        updatedAt: stamp,
      }
      return {
        ...prev,
        records: [copy, ...prev.records],
        settings: { ...prev.settings, lastUpdated: stamp },
      }
    })
  }, [])

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch, lastUpdated: nowIso() },
    }))
  }, [])

  const resetDemoData = useCallback(() => {
    clearAppData()
    setData(loadSeed())
  }, [])

  const getProjectRecords = useCallback(
    (projectId: string) => data.records.filter((r) => r.projectId === projectId),
    [data.records],
  )

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      projects: data.projects,
      records: data.records,
      settings: data.settings,
      replaceData,
      upsertProject,
      deleteProject,
      upsertRecord,
      deleteRecord,
      duplicateRecord,
      updateSettings,
      resetDemoData,
      getProjectRecords,
    }),
    [
      data,
      replaceData,
      upsertProject,
      deleteProject,
      upsertRecord,
      deleteRecord,
      duplicateRecord,
      updateSettings,
      resetDemoData,
      getProjectRecords,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
