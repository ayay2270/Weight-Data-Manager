import { Download, FileSpreadsheet, FileText, Lightbulb } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { useData } from '../hooks/useData'
import { downloadBlob } from '../utils/helpers'
import { exportCsv, exportWorkbook } from '../utils/io'

export function ExportPage() {
  const { data } = useData()

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
                <li>For normal data collection, add records directly through Weight Data.</li>
                <li>JSON backup and restore are available in Settings.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
