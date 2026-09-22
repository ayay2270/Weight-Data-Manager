import seed from '../data/seed.json'
import type { AppData } from '../data/types'

const STORAGE_KEY = 'wdm.v1.appData'

export function loadSeed(): AppData {
  return structuredClone(seed) as AppData
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return loadSeed()
    const parsed = JSON.parse(raw) as AppData
    if (!parsed?.projects || !parsed?.records || !parsed?.settings) return loadSeed()
    return parsed
  } catch {
    return loadSeed()
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function clearAppData(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function exportBackupJson(data: AppData): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

export function importBackupJson(text: string): AppData {
  const parsed = JSON.parse(text) as AppData
  if (!parsed?.projects || !parsed?.records || !parsed?.settings) {
    throw new Error('Invalid backup file')
  }
  return parsed
}
