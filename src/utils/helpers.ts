import type { AppData, ExpectedItems, Level, WeightRecord, WeightUnit } from '../data/types'
import { COLLECTED_STATUSES, LEVELS } from '../data/types'

export function nowIso(): string {
  return new Date().toISOString()
}

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`
}

export function cleanText(value: unknown): string | null {
  if (value == null) return null
  let s = String(value).replace(/\u200b/g, '').replace(/\u00a0/g, ' ').trim()
  if (!s || s.toUpperCase() === 'NA') return null
  s = s.replace(/导轨/g, '導軌').replace(/配线/g, '配線')
  return s
}

export function toWeightKg(value: number | null | undefined, unit: WeightUnit): number | null {
  if (value == null || Number.isNaN(value)) return null
  return unit === 'g' ? value / 1000 : value
}

export function formatWeight(record: {
  weightValue?: number | null
  weightUnit: WeightUnit
  status: WeightRecord['status']
}): string {
  if (record.weightValue == null) {
    return '—'
  }
  const n = record.weightValue
  const formatted =
    Math.abs(n) >= 100 ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : n.toLocaleString('en-US', { maximumFractionDigits: 3 })
  return `${formatted} ${record.weightUnit}`
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—'
  const d = iso.slice(0, 10)
  return d
}

export function emptyExpected(): ExpectedItems {
  return { Part: 0, Node: 0, Rack: 0, Package: 0 }
}

export function countByLevel(records: WeightRecord[]): ExpectedItems {
  const out = emptyExpected()
  for (const r of records) out[r.level] += 1
  return out
}

export function collectedByLevel(records: WeightRecord[]): ExpectedItems {
  const out = emptyExpected()
  for (const r of records) {
    if (COLLECTED_STATUSES.includes(r.status) && r.weightValue != null) out[r.level] += 1
  }
  return out
}

export function completenessRatio(collected: number, expected: number): number {
  if (expected <= 0) return collected > 0 ? 1 : 0
  return Math.min(1, collected / expected)
}

export function projectCompleteness(
  expected: ExpectedItems,
  records: WeightRecord[],
): { collected: ExpectedItems; overall: number; byLevel: Record<Level, number> } {
  const collected = collectedByLevel(records)
  let collectedTotal = 0
  let expectedTotal = 0
  const byLevel = {} as Record<Level, number>
  for (const level of LEVELS) {
    collectedTotal += collected[level]
    expectedTotal += expected[level]
    byLevel[level] = completenessRatio(collected[level], expected[level])
  }
  return {
    collected,
    overall: completenessRatio(collectedTotal, expectedTotal),
    byLevel,
  }
}

export function overallDataCompleteness(data: AppData): number {
  let collectedTotal = 0
  let expectedTotal = 0
  for (const project of data.projects) {
    if (project.status !== 'Active') continue
    const recs = data.records.filter((r) => r.projectId === project.id)
    const c = collectedByLevel(recs)
    for (const level of LEVELS) {
      collectedTotal += c[level]
      expectedTotal += project.expectedItems[level]
    }
  }
  return completenessRatio(collectedTotal, expectedTotal)
}

export function percentLabel(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function latestUpdated(data: AppData): string | null {
  const times = [
    data.settings.lastUpdated,
    ...data.projects.map((p) => p.updatedAt),
    ...data.records.map((r) => r.updatedAt),
  ].filter(Boolean) as string[]
  if (!times.length) return null
  return times.sort().at(-1) ?? null
}
