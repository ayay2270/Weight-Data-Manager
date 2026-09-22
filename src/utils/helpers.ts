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

export function getWeightKg(record: Pick<WeightRecord, 'weight_kg' | 'weightKg' | 'weightValue' | 'weightUnit'>): number | null {
  if (typeof record.weight_kg === 'number' && Number.isFinite(record.weight_kg)) return record.weight_kg
  if (typeof record.weightKg === 'number' && Number.isFinite(record.weightKg)) return record.weightKg
  return toWeightKg(record.weightValue, record.weightUnit)
}

export function normalizeWeightRecord<T extends Partial<WeightRecord>>(record: T): T & WeightRecord {
  const weightUnit: WeightUnit = record.weightUnit === 'g' ? 'g' : 'kg'
  const legacyWeight = typeof record.weightValue === 'number' && Number.isFinite(record.weightValue) ? record.weightValue : null
  const suppliedCanonical =
    typeof record.weight_kg === 'number' && Number.isFinite(record.weight_kg)
      ? record.weight_kg
      : typeof record.weightKg === 'number' && Number.isFinite(record.weightKg)
        ? record.weightKg
        : null
  const weight_kg = legacyWeight == null ? suppliedCanonical : toWeightKg(legacyWeight, weightUnit)
  const { weightKg: _legacyWeightKg, ...withoutLegacyWeightKg } = record
  return {
    ...withoutLegacyWeightKg,
    weightValue: legacyWeight ?? weight_kg,
    weightUnit: legacyWeight == null ? 'kg' : weightUnit,
    weight_kg,
  } as T & WeightRecord
}

export function formatWeightKg(record: Pick<WeightRecord, 'weight_kg' | 'weightKg' | 'weightValue' | 'weightUnit'>): string {
  const weightKg = getWeightKg(record)
  return weightKg == null ? '—' : `${weightKg.toFixed(3)} kg`
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
    if (COLLECTED_STATUSES.includes(r.status) && getWeightKg(r) != null) out[r.level] += 1
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
