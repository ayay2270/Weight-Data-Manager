import { useRef, useState } from 'react'
import { Download, Upload } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useData } from '../hooks/useData'
import { downloadBlob } from '../utils/helpers'
import { exportCsv, exportWorkbook, importCsvText, importWorkbook } from '../utils/io'

export function ImportExportPage() {
  const { data, replaceData } = useData()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleFile(file: File) {
    setBusy(true)
    setMessage(null)
    setError(null)
    try {
      const name = file.name.toLowerCase()
      if (name.endsWith('.csv')) {
        const text = await file.text()
        const { data: next, result } = importCsvText(text, data)
        replaceData(next)
        setMessage(`Imported ${result.added} row(s) from CSV. Projects: ${result.projectsTouched.join(', ') || '—'}`)
      } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer()
        const { data: next, result } = importWorkbook(buffer, data)
        replaceData(next)
        const warn =
          result.warnings.length > 0 ? ` Warnings: ${result.warnings.slice(0, 3).join('; ')}` : ''
        setMessage(
          `Imported ${result.added} row(s) from Excel (Part/Node/Rack/Package mapping applied). Projects: ${
            result.projectsTouched.join(', ') || '—'
          }.${warn}`,
        )
      } else {
        throw new Error('Please choose an .xlsx, .xls, or .csv file.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function exportExcel() {
    const buffer = exportWorkbook(data)
    downloadBlob(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `weight-data-${new Date().toISOString().slice(0, 10)}.xlsx`,
    )
  }

  function exportCsvFile() {
    downloadBlob(
      new Blob([exportCsv(data)], { type: 'text/csv;charset=utf-8' }),
      `weight-data-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  return (
    <>
      <PageHeader
        title="Import / Export"
        subtitle="Export the current local database to Excel or CSV for backup, analysis, or sharing."
      />
      <div className="content">
        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        <div className="panel export-primary">
          <div className="panel-head">
            <h2>Export</h2>
            <p>Current LocalStorage database · {data.records.length} records</p>
          </div>
          <div className="export-actions">
            <button type="button" className="button" onClick={exportExcel}>
              <Download size={16} /> Export to Excel (.xlsx)
              <span className="button-note">Recommended</span>
            </button>
            <button type="button" className="button secondary" onClick={exportCsvFile}>
              <Download size={16} /> Export to CSV (.csv)
            </button>
          </div>
          <div className="export-includes">
            <h3>Exported Data Includes</h3>
            <ul>
              <li>All weight records with complete information</li>
              <li>Project / Build / Phase</li>
              <li>Configuration / Included Items</li>
              <li>Source / Supplier / Reference</li>
              <li>Measured By / Reviewed By</li>
              <li>Status</li>
              <li>Normalized Weight in kg</li>
            </ul>
          </div>
        </div>

        <div className="panel tips-panel">
          <div className="panel-head">
            <h2>Tips</h2>
          </div>
          <ul className="tips-list">
            <li>Use Export to create a backup of local data.</li>
            <li>Exported files can be used for analysis or reporting.</li>
            <li>For normal data collection, add records directly through Weight Data Manager.</li>
            <li>Import is intended mainly for legacy data migration / maintenance.</li>
          </ul>
        </div>

        <details className="panel advanced-panel">
          <summary>
            <span>
              <strong>Advanced / Maintenance</strong>
              <span className="muted"> Legacy Excel / CSV import · default collapsed</span>
            </span>
          </summary>
          <div className="stack advanced-body">
            <p className="muted">For maintenance / legacy data migration only.</p>
            <p className="muted">
              Existing X01 Excel and CSV files are normalized automatically during import. Excel sheets Part Level /
              Node Level / Rack Level / Package remain supported.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleFile(file)
              }}
            />
            <div className="export-actions">
              <button type="button" className="button secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> {busy ? 'Importing…' : 'Choose file to import'}
              </button>
              <a
                className="button secondary"
                href={`${import.meta.env.BASE_URL}sample/Weight_Measurement_Record_X01.xlsx`}
              >
                <Download size={16} /> Download sample X01 Excel
              </a>
            </div>
          </div>
        </details>
      </div>
    </>
  )
}
