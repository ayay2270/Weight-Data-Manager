import { useRef, useState } from 'react'
import {
  AlertTriangle,
  Clock3,
  Database,
  Download,
  Info,
  Upload,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useData } from '../hooks/useData'
import { downloadBlob } from '../utils/helpers'
import { exportBackupJson, importBackupJson } from '../utils/storage'

const LAST_BACKUP_KEY = 'wdm.v1.lastBackupAt'

function readLastBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY)
  } catch {
    return null
  }
}

function formatBackupTime(iso: string | null): string {
  if (!iso) return 'Never'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Never'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function SettingsPage() {
  const { resetDemoData, replaceData, data } = useData()
  const [message, setMessage] = useState<string | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(() => readLastBackupAt())
  const fileRef = useRef<HTMLInputElement>(null)

  function downloadBackup() {
    downloadBlob(exportBackupJson(data), `wdm-backup-${new Date().toISOString().slice(0, 10)}.json`)
    const stamp = new Date().toISOString()
    try {
      localStorage.setItem(LAST_BACKUP_KEY, stamp)
    } catch {
      // ignore storage write failures
    }
    setLastBackupAt(stamp)
    setMessage('Full backup downloaded.')
  }

  async function restoreBackup(file: File) {
    const confirmed = window.confirm(
      [
        'Restore this full backup into this browser?',
        '',
        'This will replace:',
        '• Current projects',
        '• Current weight records',
        '• Current local settings',
        '',
        'Continue?',
      ].join('\n'),
    )
    if (!confirmed) return

    try {
      const text = await file.text()
      replaceData(importBackupJson(text))
      setMessage('Full backup restored into LocalStorage.')
    } catch {
      setMessage(null)
      window.alert('Could not restore backup. Use a JSON file exported from this app.')
    }
  }

  function restoreDemo() {
    const confirmed = window.confirm(
      [
        'Restore Demo Data?',
        '',
        'This will permanently replace:',
        '• Current projects',
        '• Current weight records',
        '• Current local settings',
        '',
        'Sample data from Weight Measurement Record_X01.xlsx will be loaded.',
        'This cannot be undone unless you have a backup.',
        '',
        'Continue?',
      ].join('\n'),
    )
    if (!confirmed) return
    resetDemoData()
    setMessage('Demo data restored from X01 seed.')
  }

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Manage local data backup and recovery."
        actions={<span className="muted">Local data is stored in this browser only.</span>}
      />
      <div className="content">
        {message ? <div className="alert success">{message}</div> : null}

        <div className="settings-layout">
          <div className="settings-main">
            <div className="panel">
              <div className="panel-head settings-section-head">
                <div className="settings-section-title">
                  <span className="settings-icon backup">
                    <Database size={16} />
                  </span>
                  <div>
                    <h2>Data Backup</h2>
                    <p>Backup or restore all local data stored in this browser.</p>
                  </div>
                </div>
              </div>

              <div className="alert info">
                <Info size={16} />
                <div>
                  The backup includes all projects, weight records, and local settings. Use it to transfer your data
                  between computers or as a safety backup. GitHub sync only updates the app code — it does not sync
                  LocalStorage data.
                </div>
              </div>

              <div className="settings-actions">
                <button type="button" className="button" onClick={downloadBackup}>
                  <Download size={16} /> Download Full Backup (.json)
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    await restoreBackup(file)
                    e.target.value = ''
                  }}
                />
                <button type="button" className="button secondary" onClick={() => fileRef.current?.click()}>
                  <Upload size={16} /> Restore Full Backup
                </button>
              </div>

              <div className="settings-meta muted">
                <Clock3 size={14} />
                Last backup: {formatBackupTime(lastBackupAt)}
              </div>
            </div>

            <div className="panel danger-zone">
              <div className="panel-head settings-section-head">
                <div className="settings-section-title">
                  <span className="settings-icon danger">
                    <AlertTriangle size={16} />
                  </span>
                  <div>
                    <h2>Danger Zone</h2>
                    <p>Demo and reset tools. Use with caution.</p>
                  </div>
                </div>
              </div>

              <div className="alert error">
                <AlertTriangle size={16} />
                <div>
                  <strong>Restore Demo Data</strong>
                  <p>
                    This will replace all current data with the sample dataset (Weight Measurement Record_X01.xlsx).
                    Your current projects, records, and settings will be permanently replaced.
                  </p>
                </div>
              </div>

              <button type="button" className="button danger" onClick={restoreDemo}>
                Restore Demo Data
              </button>
            </div>
          </div>

          <aside className="settings-aside">
            <div className="panel tips-panel">
              <div className="panel-head">
                <h2>About Data Backup</h2>
              </div>
              <ul>
                <li>Includes projects, weight records, and local settings.</li>
                <li>Keep the downloaded JSON file in a safe place.</li>
                <li>Data stays in this browser LocalStorage and is not synced automatically.</li>
              </ul>
            </div>
            <div className="panel tips-panel">
              <div className="panel-head">
                <h2>About Demo Data</h2>
              </div>
              <ul>
                <li>Restoring demo data replaces everything currently stored locally.</li>
                <li>This action cannot be undone without a backup file.</li>
                <li>Use it for testing or returning to the sample dataset.</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
