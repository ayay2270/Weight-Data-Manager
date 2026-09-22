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
    downloadBlob(new Blob([exportCsv(data)], { type: 'text/csv;charset=utf-8' }), `weight-data-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <>
      <PageHeader
        title="Import / Export"
        subtitle="Bring in the X01 Excel workbook or CSV, and export the current local database."
      />
      <div className="content">
        {message ? <div className="alert success">{message}</div> : null}
        {error ? <div className="alert error">{error}</div> : null}

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h2>Import</h2>
              <p>Excel sheets Part Level / Node Level / Rack Level / Package are normalized automatically.</p>
            </div>
            <div className="stack">
              <p className="muted">
                Existing X01 Excel and CSV files are normalized automatically during import.
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
              <a className="button secondary" href={`${import.meta.env.BASE_URL}sample/Weight_Measurement_Record_X01.xlsx`}>
                <Download size={16} /> Download sample X01 Excel
              </a>
              <button type="button" className="button" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> {busy ? 'Importing…' : 'Choose file to import'}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Export</h2>
              <p>Current LocalStorage database · {data.records.length} records</p>
            </div>
            <div className="stack">
              <button type="button" className="button" onClick={exportExcel}>
                <Download size={16} /> Export Excel (.xlsx)
              </button>
              <button type="button" className="button secondary" onClick={exportCsvFile}>
                <Download size={16} /> Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
