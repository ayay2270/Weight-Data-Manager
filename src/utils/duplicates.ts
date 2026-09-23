import type { Level, WeightRecord } from '../data/types'

function norm(value?: string | null): string {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase()
}

export type DuplicateCandidate = {
  projectId: string
  buildPhase?: string | null
  level: Level
  description: string
  lenovoPn?: string | null
  configuration?: string | null
}

/**
 * Simple duplicate check for manual Add Record.
 * Strong match: same project + same Lenovo PN (when PN present).
 * Soft match: same project + level + description + build phase + configuration.
 */
export function findPossibleDuplicate(
  candidate: DuplicateCandidate,
  records: WeightRecord[],
  excludeId?: string | null,
): WeightRecord | null {
  const projectId = candidate.projectId
  if (!projectId) return null

  const pn = norm(candidate.lenovoPn)
  const description = norm(candidate.description)
  const buildPhase = norm(candidate.buildPhase)
  const configuration = norm(candidate.configuration)
  const level = candidate.level

  let softMatch: WeightRecord | null = null

  for (const record of records) {
    if (excludeId && record.id === excludeId) continue
    if (record.projectId !== projectId) continue

    const recordPn = norm(record.lenovoPn)
    if (pn && recordPn && pn === recordPn) {
      return record
    }

    if (
      record.level === level &&
      description &&
      norm(record.description) === description &&
      buildPhase === norm(record.buildPhase) &&
      configuration === norm(record.configuration)
    ) {
      softMatch = softMatch || record
    }
  }

  return softMatch
}
