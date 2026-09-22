import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText, Lightbulb, Settings2, Upload } from 'lucide-react'
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
        title="Export"
        subtitle="Export the current local database to Excel or CSV for backup, analysis, or sharing."
      />
      <div className="content">
        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        <div className="export-layout">
          <div className="export-main">
            <div className="panel export-card">
              <div className="panel-head export-card-head">
                <div className="section-title">
                  <Download size={18} className="section-title-icon" />
                  <div>
                    <h2>Export</h2>
                    <p>Current LocalStorage database · {data.records.length} records</p>
                  </div>
                </div>
              </div>
              <p className="export-intro">
                Export the current weight database to Excel or CSV format. The exported file can be used for backup,
                analysis, or sharing.
              </p>

              <div className="export-option-grid">
                <button type="button" className="export-option export-option-primary" onClick={exportExcel}>
                  <FileSpreadsheet size={22} />
                  <span className="export-option-body">
                    <strong>Export to Excel (.xlsx)</strong>
                    <small>Recommended format with multiple sheets</small>
                  </span>
                  <span className="export-option-badge">Recommended</span>
                </button>
                <button type="button" className="export-option export-option-secondary" onClick={exportCsvFile}>
                  <FileText size={22} />
                  <span className="export-option-body">
                    <strong>Export to CSV (.csv)</strong>
                    <small>Flat file format / single sheet</small>
                  </span>
                </button>
              </div>

              <div className="export-includes-panel">
                <h3>Exported Data Includes</h3>
                <ul>
                  <li>All weight records with complete information</li>
                  <li>Project / Build / Phase · Configuration / Included Items</li>
                  <li>Source / Supplier / Reference · Measured By / Reviewed By · Status</li>
                  <li>Normalized Weight in kg</li>
                </ul>
              </div>
            </div>

            <div className="panel tips-panel">
              <div className="panel-head">
                <div className="section-title">
                  <Lightbulb size={18} className="section-title-icon tips" />
                  <h2>Tips</h2>
                </div>
              </div>
              <ul className="tips-list">
                <li>Use export to create a backup of your local data.</li>
                <li>Exported files can be used for analysis or reporting.</li>
                <li>For normal data collection, add records directly through Weight Data Manager.</li>
                <li>Import is intended mainly for legacy data migration / maintenance.</li>
              </ul>
            </div>
          </div>

          <aside className="export-side">
            <details className="panel advanced-panel">
              <summary>
                <span className="advanced-summary-main">
                  <Settings2 size={16} />
                  <span>
                    <strong>Advanced / Maintenance</strong>
                    <small className="muted">Excel / CSV Import</small>
                  </span>
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
                <div className="advanced-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                  >
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
          </aside>
        </div>
      </div>
    </>
  )
}
