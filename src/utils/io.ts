import * as XLSX from 'xlsx'
import type { AppData, Level, WeightRecord, WeightUnit } from '../data/types'
import { getWeightKg } from './helpers'

const LEVEL_SHEETS: { level: Level; names: string[]; defaultUnit: WeightUnit }[] = [
  { level: 'Part', names: ['Part Level', 'Part'], defaultUnit: 'g' },
  { level: 'Node', names: ['Node Level', 'Node'], defaultUnit: 'kg' },
  { level: 'Rack', names: ['Rack Level', 'Rack'], defaultUnit: 'kg' },
  { level: 'Package', names: ['Package'], defaultUnit: 'kg' },
]

function recordsForExport(data: AppData, subset?: WeightRecord[]): WeightRecord[] {
  return subset ?? data.records
}

export function exportWorkbook(data: AppData, subset?: WeightRecord[]): ArrayBuffer {
  const source = recordsForExport(data, subset)
  const wb = XLSX.utils.book_new()
  for (const { level, names } of LEVEL_SHEETS) {
    const sheetName = names[0]
    const rows = source
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

export function exportCsv(data: AppData, subset?: WeightRecord[]): string {
  const source = recordsForExport(data, subset)
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
  for (const r of source) {
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
