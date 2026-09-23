import { useState } from 'react'
import { Download, FileSpreadsheet, FileText, Lightbulb } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useData } from '../hooks/useData'
import { loadExportContext } from '../utils/exportContext'
import { downloadBlob } from '../utils/helpers'
import { exportCsv, exportViewCsv, exportViewWorkbook, exportWorkbook } from '../utils/io'
import type { WeightRecord } from '../data/types'

type ExportScope = 'all' | 'filtered' | 'project' | 'selected'
type ExportFormat = 'xlsx' | 'csv'

export function ExportPage() {
  const { data, projects } = useData()
  const context = loadExportContext()
  const [scope, setScope] = useState<ExportScope>('all')
  const [projectCode, setProjectCode] = useState(projects[0]?.code || '')
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedCount = context.selectedIds.length
  const filteredCount = context.orderedFilteredRecordIds.length

  function resolveRecords(): WeightRecord[] | null {
    if (scope === 'all') return data.records
    if (scope === 'filtered') {
      if (!filteredCount) {
        setError('No Current Filtered View is available. Open Weight Data, apply filters, then return here.')
        return null
      }
      const byId = new Map(data.records.map((record) => [record.id, record]))
      return context.orderedFilteredRecordIds
        .map((id) => byId.get(id))
        .filter((record): record is WeightRecord => Boolean(record))
    }
    if (scope === 'project') {
      if (!projectCode) {
        setError('Please select a project.')
        return null
      }
      return data.records.filter((r) => r.projectCode === projectCode)
    }
    if (!selectedCount) {
      setError('No rows selected. Open Weight Data and check the rows you want to export.')
      return null
    }
    const idSet = new Set(context.selectedIds)
    return data.records.filter((r) => idSet.has(r.id))
  }

  function runExport() {
    setMessage(null)
    setError(null)
    const subset = resolveRecords()
    if (!subset) return
    const stamp = new Date().toISOString().slice(0, 10)
    if (scope === 'filtered') {
      if (format === 'xlsx') {
        downloadBlob(
          new Blob([exportViewWorkbook(subset, context.visibleColumns)], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          `weight-data-${stamp}.xlsx`,
        )
      } else {
        downloadBlob(
          new Blob([exportViewCsv(subset, context.visibleColumns)], { type: 'text/csv;charset=utf-8' }),
          `weight-data-${stamp}.csv`,
        )
      }
      setMessage(`Exported ${subset.length} record(s) from the current filtered view.`)
      return
    }
    if (format === 'xlsx') {
      const buffer = exportWorkbook(data, subset)
      downloadBlob(
        new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        `weight-data-${stamp}.xlsx`,
      )
    } else {
      downloadBlob(new Blob([exportCsv(data, subset)], { type: 'text/csv;charset=utf-8' }), `weight-data-${stamp}.csv`)
    }
    setMessage(`Exported ${subset.length} record(s) as ${format === 'xlsx' ? 'Excel' : 'CSV'}.`)
  }

  return (
    <>
      <PageHeader
        title="Export"
        subtitle="Export weight records by scope — all data, current filtered view, a project, or selected rows."
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
                    <h2>Export Weight Data</h2>
                    <p>LocalStorage database · {data.records.length} total records</p>
                  </div>
                </div>
              </div>

              <div className="export-scope-block">
                <h3>Export Scope</h3>
                <label className="export-radio">
                  <input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} />
                  <span>
                    <strong>All Records</strong>
                    <small>Export every weight record in this browser.</small>
                  </span>
                </label>
                <label className="export-radio">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'filtered'}
                    onChange={() => setScope('filtered')}
                  />
                  <span>
                    <strong>Current Filtered View{filteredCount ? ` (${filteredCount})` : ''}</strong>
                    <small>Uses the latest Weight Data search / filters / saved view.</small>
                  </span>
                </label>
                <label className="export-radio">
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'project'}
                    onChange={() => setScope('project')}
                  />
                  <span>
                    <strong>Current Project</strong>
                    <small>Export records for one project only.</small>
                  </span>
                </label>
                {scope === 'project' ? (
                  <select
                    className="export-project-select"
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    aria-label="Project to export"
                  >
                    {!projects.length ? <option value="">No projects</option> : null}
                    {projects.map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                ) : null}
                <label className={`export-radio${selectedCount ? '' : ' disabled'}`}>
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === 'selected'}
                    disabled={!selectedCount}
                    onChange={() => setScope('selected')}
                  />
                  <span>
                    <strong>Selected Records ({selectedCount})</strong>
                    <small>
                      {selectedCount
                        ? 'Export only checked rows from Weight Data.'
                        : 'Select rows on the Weight Data page first.'}
                    </small>
                  </span>
                </label>
              </div>

              <div className="export-scope-block">
                <h3>Export Format</h3>
                <label className="export-radio">
                  <input
                    type="radio"
                    name="format"
                    checked={format === 'xlsx'}
                    onChange={() => setFormat('xlsx')}
                  />
                  <span className="export-format-option">
                    <FileSpreadsheet size={18} />
                    <span>
                      <strong>Excel (.xlsx)</strong>
                      <small>Recommended · multiple sheets by level</small>
                    </span>
                  </span>
                </label>
                <label className="export-radio">
                  <input type="radio" name="format" checked={format === 'csv'} onChange={() => setFormat('csv')} />
                  <span className="export-format-option">
                    <FileText size={18} />
                    <span>
                      <strong>CSV (.csv)</strong>
                      <small>Flat file · single sheet</small>
                    </span>
                  </span>
                </label>
              </div>

              <div className="export-actions">
                <button type="button" className="button" onClick={runExport}>
                  <Download size={16} /> Export
                </button>
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
                <li>Apply filters or select rows on Weight Data before using Filtered View / Selected Records.</li>
                <li>JSON full backup remains available in Settings.</li>
                <li>Export never imports files — measurement entry stays in Weight Data.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
