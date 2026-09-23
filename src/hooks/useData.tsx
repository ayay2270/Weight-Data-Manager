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

const LOCKED_MEASUREMENT_STATUSES = new Set(['Pending Review', 'Verified', 'Rejected'])

function measurementUnchanged(existing: WeightRecord, next: WeightRecord): boolean {
  const keys: (keyof WeightRecord)[] = [
    'projectId',
    'level',
    'description',
    'lenovoPn',
    'customerPn',
    'manufacturer',
    'category',
    'weightValue',
    'weightUnit',
    'buildPhase',
    'configuration',
    'supplier',
    'reference',
    'measuredBy',
    'measuredDate',
    'source',
    'note',
  ]
  return keys.every((key) => (existing[key] ?? null) === (next[key] ?? null))
}
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
      const previous = prev.projects.find((p) => p.id === project.id)
      const stamp = nowIso()
      const saved: Project = {
        ...project,
        createdAt: project.createdAt || previous?.createdAt || stamp,
        updatedAt: stamp,
      }
      if (saved.expectedItems == null && previous?.expectedItems) {
        saved.expectedItems = previous.expectedItems
      }
      if (saved.expectedItems == null) delete saved.expectedItems
      const projects = previous
        ? prev.projects.map((p) => (p.id === project.id ? saved : p))
        : [...prev.projects, saved]
      const codeChanged = Boolean(previous && previous.code !== saved.code)
      const records = codeChanged
        ? prev.records.map((record) =>
            record.projectId === saved.id ? { ...record, projectCode: saved.code, updatedAt: stamp } : record,
          )
        : prev.records
      return { ...prev, projects, records, settings: { ...prev.settings, lastUpdated: stamp } }
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
      const existing = prev.records.find((r) => r.id === normalized.id)
      if (
        existing &&
        LOCKED_MEASUREMENT_STATUSES.has(existing.status) &&
        !measurementUnchanged(existing, normalized)
      ) {
        return prev
      }
      const records = existing
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
        reviewedBy: null,
        reviewedDate: null,
        reviewComment: null,
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
