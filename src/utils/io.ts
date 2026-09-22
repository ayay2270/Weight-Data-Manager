import * as XLSX from 'xlsx'
import type { AppData, DataSource, Level, Project, RecordStatus, WeightRecord, WeightUnit } from '../data/types'
import {
  cleanText,
  getWeightKg,
  migrateRecordStatus,
  normalizeDataSource,
  nowIso,
  toWeightKg,
  uid,
} from './helpers'

const LEVEL_SHEETS: { level: Level; names: string[]; defaultUnit: WeightUnit }[] = [
  { level: 'Part', names: ['Part Level', 'Part'], defaultUnit: 'g' },
  { level: 'Node', names: ['Node Level', 'Node'], defaultUnit: 'kg' },
  { level: 'Rack', names: ['Rack Level', 'Rack'], defaultUnit: 'kg' },
  { level: 'Package', names: ['Package'], defaultUnit: 'kg' },
]

function parseWeight(
  raw: unknown,
  defaultUnit: WeightUnit,
  suppliedUnit?: unknown,
): { value: number | null; unit: WeightUnit; status: RecordStatus; original: string | null; source: DataSource } {
  const supplied = cleanText(suppliedUnit)?.toLowerCase()
  const inputUnit: WeightUnit = supplied === 'g' ? 'g' : supplied === 'kg' ? 'kg' : defaultUnit
  if (raw == null || raw === '') {
    return { value: null, unit: inputUnit, status: 'Need Recheck', original: null, source: 'Unknown' }
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { value: raw, unit: inputUnit, status: 'Pending Review', original: null, source: 'Internal Measurement' }
  }
  const s = cleanText(raw)
  if (!s) {
    return { value: null, unit: inputUnit, status: 'Need Recheck', original: null, source: 'Unknown' }
  }
  const kgMatch = s.match(/([\d.]+)\s*kg/i)
  const gMatch = s.match(/([\d.]+)\s*g\b/i)
  if (/TBD|\?/i.test(s)) {
    if (kgMatch) {
      return { value: Number(kgMatch[1]), unit: 'kg', status: 'Pending Review', original: s, source: 'Estimated' }
    }
    if (gMatch) {
      return { value: Number(gMatch[1]), unit: 'g', status: 'Pending Review', original: s, source: 'Estimated' }
    }
    return { value: null, unit: inputUnit, status: 'Need Recheck', original: s, source: 'Unknown' }
  }
  if (kgMatch) {
    return { value: Number(kgMatch[1]), unit: 'kg', status: 'Pending Review', original: null, source: 'Internal Measurement' }
  }
  if (gMatch) {
    return { value: Number(gMatch[1]), unit: 'g', status: 'Pending Review', original: null, source: 'Internal Measurement' }
  }
  const num = Number(s.replace(/,/g, ''))
  if (Number.isFinite(num)) {
    return { value: num, unit: inputUnit, status: 'Pending Review', original: null, source: 'Internal Measurement' }
  }
  return { value: null, unit: inputUnit, status: 'Need Recheck', original: s, source: 'Unknown' }
}

function sheetToRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null, raw: true })
  if (!rows.length) return []

  // Package sheet may have a title row before headers
  let headerIdx = 0
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i] as unknown[]
    const joined = (row || []).map((c) => String(c ?? '').toLowerCase()).join('|')
    if (joined.includes('part description') || joined.includes('description')) {
      headerIdx = i
      break
    }
  }

  const headers = (rows[headerIdx] as unknown[]).map((h) => cleanText(h) || '')
  const out: Record<string, unknown>[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue
    const obj: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      if (h) obj[h] = row[idx]
    })
    out.push(obj)
  }
  return out
}

function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key]
    const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase())
    if (found && row[found] != null && String(row[found]).trim() !== '') return row[found]
  }
  return null
}

function pickWeight(row: Record<string, unknown>): { raw: unknown; unit: unknown } {
  const variants: [string, WeightUnit][] = [
    ['Weight (g)', 'g'],
    ['Weight(g)', 'g'],
    ['Weight (kg)', 'kg'],
    ['Weight(kg)', 'kg'],
    ['Weight', 'kg'],
  ]
  for (const [header, headerUnit] of variants) {
    const raw = pick(row, [header])
    if (raw != null) return { raw, unit: pick(row, ['Unit', 'Weight Unit']) ?? headerUnit }
  }
  return { raw: null, unit: pick(row, ['Unit', 'Weight Unit']) }
}

function excelDate(value: unknown): string | null {
  if (value == null || value === '') return null
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    const mm = String(parsed.m).padStart(2, '0')
    const dd = String(parsed.d).padStart(2, '0')
    return `${parsed.y}-${mm}-${dd}`
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const s = cleanText(value)
  if (!s) return null
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return s
}

function resolveImportedStatus(
  statusRaw: unknown,
  sourceRaw: unknown,
  fallbackStatus: RecordStatus,
  fallbackSource: DataSource,
): { status: RecordStatus; source: DataSource } {
  const sourceHint = cleanText(sourceRaw) || fallbackSource
  if (statusRaw == null || String(statusRaw).trim() === '') {
    return { status: fallbackStatus, source: normalizeDataSource(sourceHint, fallbackSource) }
  }
  const migrated = migrateRecordStatus(statusRaw, sourceHint)
  return {
    status: migrated.status,
    source: normalizeDataSource(migrated.source ?? sourceHint, fallbackSource),
  }
}

function ensureProject(projects: Project[], code: string, stamp: string): Project {
  let project = projects.find((p) => p.code === code)
  if (!project) {
    project = {
      id: uid('prj'),
      code,
      name: code,
      phase: null,
      status: 'Active',
      expectedItems: { Part: 0, Node: 0, Rack: 0, Package: 0 },
      notes: null,
      createdAt: stamp,
      updatedAt: stamp,
    }
    projects.push(project)
  }
  return project
}

function pickExtendedFields(row: Record<string, unknown>) {
  return {
    buildPhase: cleanText(pick(row, ['Build / Phase', 'Build Phase', 'Phase', 'Build'])),
    configuration: cleanText(
      pick(row, ['Configuration / Included Items', 'Configuration', 'Included Items']),
    ),
    supplier: cleanText(pick(row, ['Supplier / Data Provider', 'Supplier', 'Data Provider'])),
    reference: cleanText(
      pick(row, ['Reference / Document Rev.', 'Reference', 'Document Rev.', 'Document Rev']),
    ),
    measuredBy: cleanText(pick(row, ['Measured By', 'MeasuredBy', 'Tester'])),
    reviewedBy: cleanText(pick(row, ['Reviewed By', 'ReviewedBy', 'Reviewer'])),
    reviewedDate: excelDate(pick(row, ['Reviewed Date', 'ReviewedDate'])),
  }
}

export interface ImportResult {
  added: number
  projectsTouched: string[]
  warnings: string[]
}

export function importWorkbook(buffer: ArrayBuffer, data: AppData): { data: AppData; result: ImportResult } {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const stamp = nowIso()
  const projects = [...data.projects]
  const records = [...data.records]
  const warnings: string[] = []
  const touched = new Set<string>()
  let added = 0

  for (const { level, names, defaultUnit } of LEVEL_SHEETS) {
    const sheetName = workbook.SheetNames.find((n) => names.some((x) => x.toLowerCase() === n.toLowerCase()))
    if (!sheetName) continue
    const rows = sheetToRows(workbook.Sheets[sheetName])
    for (const row of rows) {
      const description = cleanText(pick(row, ['Part Description', 'Description', 'Item']))
      if (!description) continue
      const projectCode = cleanText(pick(row, ['Project'])) || 'UNASSIGNED'
      const project = ensureProject(projects, projectCode, stamp)
      touched.add(project.code)
      const weight = pickWeight(row)
      const parsed = parseWeight(weight.raw, defaultUnit, weight.unit)
      if (parsed.original) warnings.push(`${description}: ${parsed.original}`)
      const note = cleanText(pick(row, ['Note', 'Notes']))
      const extended = pickExtendedFields(row)
      const resolved = resolveImportedStatus(
        pick(row, ['Status']),
        pick(row, ['Source', 'Data Source']),
        parsed.status,
        parsed.source,
      )
      const record: WeightRecord = {
        id: uid('rec'),
        projectId: project.id,
        projectCode: project.code,
        level,
        description,
        lenovoPn: cleanText(pick(row, ['Lenovo PN', 'LenovoPN', 'PN'])),
        customerPn: cleanText(pick(row, ['MSFT PN', 'Customer PN', 'CustomerPN'])),
        manufacturer: cleanText(pick(row, ['Manufacturer'])),
        category: cleanText(pick(row, ['Part Category', 'Category'])) || (level === 'Package' ? 'Packaging' : null),
        weightValue: parsed.value,
        weightUnit: parsed.unit,
        weight_kg: toWeightKg(parsed.value, parsed.unit),
        buildPhase: extended.buildPhase || project.phase || null,
        configuration: extended.configuration,
        supplier: extended.supplier,
        reference: extended.reference,
        measuredBy: extended.measuredBy,
        measuredDate: excelDate(pick(row, ['Measured Date', 'Date'])),
        source: resolved.source,
        status: resolved.status,
        reviewedBy: extended.reviewedBy,
        reviewedDate: extended.reviewedDate,
        note,
        originalWeightText: parsed.original,
        createdAt: stamp,
        updatedAt: stamp,
      }
      records.push(record)
      added += 1
      project.expectedItems[level] = Math.max(
        project.expectedItems[level],
        records.filter((r) => r.projectId === project.id && r.level === level).length,
      )
      project.updatedAt = stamp
    }
  }

  // Flat CSV-like single sheet fallback
  if (added === 0 && workbook.SheetNames.length) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = sheetToRows(sheet)
    for (const row of rows) {
      const description = cleanText(pick(row, ['Part Description', 'Description', 'Item']))
      if (!description) continue
      const levelRaw = cleanText(pick(row, ['Level', 'Type'])) || 'Part'
      const level = (['Part', 'Node', 'Rack', 'Package'].includes(levelRaw) ? levelRaw : 'Part') as Level
      const defaultUnit: WeightUnit = level === 'Part' ? 'g' : 'kg'
      const projectCode = cleanText(pick(row, ['Project'])) || 'UNASSIGNED'
      const project = ensureProject(projects, projectCode, stamp)
      touched.add(project.code)
      const weight = pickWeight(row)
      const parsed = parseWeight(weight.raw, defaultUnit, weight.unit)
      const extended = pickExtendedFields(row)
      const resolved = resolveImportedStatus(
        pick(row, ['Status']),
        pick(row, ['Source', 'Data Source']),
        parsed.status,
        parsed.source,
      )
      const record: WeightRecord = {
        id: uid('rec'),
        projectId: project.id,
        projectCode: project.code,
        level,
        description,
        lenovoPn: cleanText(pick(row, ['Lenovo PN', 'LenovoPN'])),
        customerPn: cleanText(pick(row, ['MSFT PN', 'Customer PN'])),
        manufacturer: cleanText(pick(row, ['Manufacturer'])),
        category: cleanText(pick(row, ['Part Category', 'Category'])),
        weightValue: parsed.value,
        weightUnit: parsed.unit,
        weight_kg: toWeightKg(parsed.value, parsed.unit),
        buildPhase: extended.buildPhase || project.phase || null,
        configuration: extended.configuration,
        supplier: extended.supplier,
        reference: extended.reference,
        measuredBy: extended.measuredBy,
        measuredDate: excelDate(pick(row, ['Measured Date', 'Date'])),
        source: resolved.source,
        status: resolved.status,
        reviewedBy: extended.reviewedBy,
        reviewedDate: extended.reviewedDate,
        note: cleanText(pick(row, ['Note', 'Notes'])),
        originalWeightText: parsed.original,
        createdAt: stamp,
        updatedAt: stamp,
      }
      records.push(record)
      added += 1
    }
  }

  return {
    data: {
      ...data,
      projects,
      records,
      settings: { ...data.settings, lastUpdated: stamp },
    },
    result: { added, projectsTouched: [...touched], warnings },
  }
}

export function exportWorkbook(data: AppData): ArrayBuffer {
  const wb = XLSX.utils.book_new()
  for (const { level, names } of LEVEL_SHEETS) {
    const sheetName = names[0]
    const rows = data.records
      .filter((r) => r.level === level)
      .map((r) => ({
        'Part Description': r.description,
        'Lenovo PN': r.lenovoPn || '',
        'MSFT PN': r.customerPn || '',
        Manufacturer: r.manufacturer || '',
        'Part Category': r.category || '',
        'Weight (kg)': getWeightKg(r) ?? r.originalWeightText ?? '',
        'Build / Phase': r.buildPhase || '',
        'Configuration / Included Items': r.configuration || '',
        'Supplier / Data Provider': r.supplier || '',
        'Reference / Document Rev.': r.reference || '',
        'Measured By': r.measuredBy || '',
        'Measured Date': r.measuredDate || '',
        'Reviewed By': r.reviewedBy || '',
        'Reviewed Date': r.reviewedDate || '',
        Project: r.projectCode,
        Note: r.note || '',
        Source: r.source,
        Status: r.status,
      }))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
}

export function exportCsv(data: AppData): string {
  const header = [
    'Level',
    'Project',
    'Build / Phase',
    'Description',
    'Lenovo PN',
    'MSFT PN',
    'Manufacturer',
    'Category',
    'Weight (kg)',
    'Unit',
    'Configuration / Included Items',
    'Supplier / Data Provider',
    'Reference / Document Rev.',
    'Measured By',
    'Measured Date',
    'Source',
    'Status',
    'Reviewed By',
    'Reviewed Date',
    'Note',
  ]
  const lines = [header.join(',')]
  for (const r of data.records) {
    const cols = [
      r.level,
      r.projectCode,
      r.buildPhase || '',
      r.description,
      r.lenovoPn || '',
      r.customerPn || '',
      r.manufacturer || '',
      r.category || '',
      getWeightKg(r) ?? '',
      'kg',
      r.configuration || '',
      r.supplier || '',
      r.reference || '',
      r.measuredBy || '',
      r.measuredDate || '',
      r.source,
      r.status,
      r.reviewedBy || '',
      r.reviewedDate || '',
      r.note || '',
    ].map((v) => {
      const s = String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    })
    lines.push(cols.join(','))
  }
  return lines.join('\n')
}

export function importCsvText(text: string, data: AppData): { data: AppData; result: ImportResult } {
  const wb = XLSX.read(text, { type: 'string' })
  return importWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer, data)
}
