import { useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useData } from '../hooks/useData'
import type { WeightUnit } from '../data/types'
import { downloadBlob } from '../utils/helpers'
import { exportBackupJson, importBackupJson } from '../utils/storage'

export function SettingsPage() {
  const { projects, settings, updateSettings, resetDemoData, replaceData, data } = useData()
  const [message, setMessage] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <PageHeader title="Settings" subtitle="Defaults, local backup, and demo data reset." />
      <div className="content">
        {message ? <div className="alert success">{message}</div> : null}

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h2>Defaults</h2>
            </div>
            <div className="stack">
              <label>
                Default Unit
                <select
                  value={settings.defaultUnit}
                  onChange={(e) => {
                    updateSettings({ defaultUnit: e.target.value as WeightUnit })
                    setMessage('Default unit updated.')
                  }}
                >
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                </select>
              </label>
              <label>
                Default Project
                <select
                  value={settings.defaultProjectId || ''}
                  onChange={(e) => {
                    updateSettings({ defaultProjectId: e.target.value || null })
                    setMessage('Default project updated.')
                  }}
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Data Backup</h2>
              <p>JSON snapshot of projects, records, and settings in this browser.</p>
            </div>
            <div className="stack">
              <button
                type="button"
                className="button"
                onClick={() => {
                  downloadBlob(exportBackupJson(data), `wdm-backup-${new Date().toISOString().slice(0, 10)}.json`)
                  setMessage('Backup downloaded.')
                }}
              >
                Download JSON Backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const text = await file.text()
                    replaceData(importBackupJson(text))
                    setMessage('Backup restored into LocalStorage.')
                  } catch {
                    setMessage(null)
                    alert('Could not restore backup. Use a JSON file exported from this app.')
                  }
                  e.target.value = ''
                }}
              />
              <button type="button" className="button secondary" onClick={() => fileRef.current?.click()}>
                Restore JSON Backup
              </button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Reset Demo Data</h2>
            <p>Reload the seeded dataset normalized from Weight Measurement Record_X01.xlsx.</p>
          </div>
          <button
            type="button"
            className="button danger"
            onClick={() => {
              if (confirm('Replace all local data with the demo seed from X01?')) {
                resetDemoData()
                setMessage('Demo data restored from X01 seed.')
              }
            }}
          >
            Reset Demo Data
          </button>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Future integrations</h2>
          </div>
          <p className="muted">
            V1 is a static web app (JSON + LocalStorage). Supabase or SharePoint connectors can be added later without
            changing the normalized Project / WeightRecord model.
          </p>
        </div>
      </div>
    </>
  )
}
