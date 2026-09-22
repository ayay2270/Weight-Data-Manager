export type Level = 'Part' | 'Node' | 'Rack' | 'Package'

export type DataSource =
  | 'Internal Measurement'
  | 'Supplier'
  | 'Specification'
  | 'Estimated'
  | 'Unknown'

export type RecordStatus = 'Draft' | 'Measured' | 'Verified' | 'Estimated' | 'Missing'

export type ProjectStatus = 'Active' | 'Archived'

export type WeightUnit = 'g' | 'kg'

export interface ExpectedItems {
  Part: number
  Node: number
  Rack: number
  Package: number
}

export interface Project {
  id: string
  code: string
  name: string
  phase?: string | null
  status: ProjectStatus
  expectedItems: ExpectedItems
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface WeightRecord {
  id: string
  projectId: string
  projectCode: string
  level: Level
  description: string
  lenovoPn?: string | null
  customerPn?: string | null
  manufacturer?: string | null
  category?: string | null
  weightValue?: number | null
  weightUnit: WeightUnit
  weightKg?: number | null
  measuredDate?: string | null
  source: DataSource
  status: RecordStatus
  note?: string | null
  originalWeightText?: string | null
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  defaultUnit: WeightUnit
  defaultProjectId?: string | null
  lastUpdated?: string
}

export interface AppData {
  version: number
  projects: Project[]
  records: WeightRecord[]
  settings: AppSettings
}

export const LEVELS: Level[] = ['Part', 'Node', 'Rack', 'Package']

export const DATA_SOURCES: DataSource[] = [
  'Internal Measurement',
  'Supplier',
  'Specification',
  'Estimated',
  'Unknown',
]

export const RECORD_STATUSES: RecordStatus[] = [
  'Draft',
  'Measured',
  'Verified',
  'Estimated',
  'Missing',
]

export const COLLECTED_STATUSES: RecordStatus[] = ['Measured', 'Verified']
