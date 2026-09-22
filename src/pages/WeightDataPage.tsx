import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Columns3, Copy, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { RecordFormModal } from '../components/RecordFormModal'
import { useData } from '../hooks/useData'
import type { Level, RecordStatus, WeightRecord } from '../data/types'
import { LEVELS, RECORD_STATUSES } from '../data/types'
import { formatWeightKg, statusBadgeClass, todayDate } from '../utils/helpers'

type ColumnKey =
  | 'project'
  | 'description'
  | 'lenovoPn'
  | 'customerPn'
  | 'manufacturer'
  | 'category'
  | 'buildPhase'
  | 'level'
  | 'weight'
  | 'measuredDate'
  | 'note'
  | 'source'
  | 'measuredBy'
  | 'status'
  | 'reviewedBy'
  | 'actions'

const COLUMN_STORAGE_KEY = 'weightDataVisibleColumns'
const PAGE_SIZE = 15

const COLUMN_OPTIONS: { key: ColumnKey; label: string; locked?: boolean }[] = [
  { key: 'project', label: 'Project', locked: true },
  { key: 'description', label: 'Description', locked: true },
  { key: 'lenovoPn', label: 'Lenovo PN' },
  { key: 'customerPn', label: 'MSFT PN' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'category', label: 'Part Category' },
  { key: 'buildPhase', label: 'Build / Phase' },
  { key: 'level', label: 'Level' },
  { key: 'weight', label: 'Weight (kg)' },
  { key: 'measuredDate', label: 'Measured Date' },
  { key: 'note', label: 'Note' },
  { key: 'source', label: 'Source' },
  { key: 'measuredBy', label: 'Measured By' },
  { key: 'status', label: 'Status' },
  { key: 'reviewedBy', label: 'Reviewed By' },
  { key: 'actions', label: 'Actions' },
]

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'project',
  'description',
  'lenovoPn',
  'category',
  'level',
  'weight',
  'note',
  'source',
  'status',
  'actions',
]

function loadVisibleColumns(): ColumnKey[] {
  try {
    const raw = localStorage.getItem(COLUMN_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_COLUMNS
    const allowed = parsed.filter((key): key is ColumnKey =>
      COLUMN_OPTIONS.some((option) => option.key === key),
    )
    return [...new Set<ColumnKey>(['project', 'description', ...allowed])]
  } catch {
    return DEFAULT_VISIBLE_COLUMNS
  }
}

export function WeightDataPage() {
  const { projects, records, settings, upsertRecord, deleteRecord, duplicateRecord } = useData()
  const [params] = useSearchParams()
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState(params.get('project') || '')
  const [levelFilter, setLevelFilter] = useState<Level | ''>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [buildPhaseFilter, setBuildPhaseFilter] = useState('')
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(loadVisibleColumns)
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<WeightRecord | null>(null)
  const [showForm, setShowForm] = useState(false)

  const buildPhaseOptions = useMemo(() => {
    const values = new Set<string>()
    for (const r of records) {
      if (r.buildPhase) values.add(r.buildPhase)
    }
    for (const p of projects) {
      if (p.phase) values.add(p.phase)
    }
    return [...values].sort()
  }, [records, projects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records
      .filter((r) => (levelFilter ? r.level === levelFilter : true))
      .filter((r) => (projectFilter ? r.projectCode === projectFilter : true))
      .filter((r) => (statusFilter ? r.status === statusFilter : true))
      .filter((r) => (sourceFilter ? r.source === sourceFilter : true))
      .filter((r) => (buildPhaseFilter ? (r.buildPhase || '') === buildPhaseFilter : true))
      .filter((r) => {
        if (!q) return true
        return [
          r.description,
          r.lenovoPn,
          r.customerPn,
          r.manufacturer,
          r.category,
          r.projectCode,
          r.buildPhase,
          r.configuration,
          r.supplier,
          r.reference,
          r.measuredBy,
          r.reviewedBy,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [records, levelFilter, projectFilter, statusFilter, sourceFilter, buildPhaseFilter, query])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRecords = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const isVisible = (key: ColumnKey) => visibleColumns.includes(key)

  function updateVisibleColumns(next: ColumnKey[]) {
    const normalized = [...new Set<ColumnKey>(['project', 'description', ...next])]
    setVisibleColumns(normalized)
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(normalized))
  }

  function toggleColumn(key: ColumnKey) {
    if (key === 'project' || key === 'description') return
    updateVisibleColumns(isVisible(key) ? visibleColumns.filter((column) => column !== key) : [...visibleColumns, key])
  }

  function openAdd() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(record: WeightRecord) {
    setEditing(record)
    setShowForm(true)
  }

  function applyReview(record: WeightRecord, status: RecordStatus) {
    if (status === 'Verified') {
      const reviewedBy = window.prompt('Reviewed By (required for Verified):', record.reviewedBy || '')
      if (reviewedBy == null) return
      if (!reviewedBy.trim()) {
        window.alert('Reviewed By is required when Status is Verified.')
        return
      }
      upsertRecord({
        ...record,
        status,
        reviewedBy: reviewedBy.trim(),
        reviewedDate: record.reviewedDate || todayDate(),
      })
      return
    }
    upsertRecord({ ...record, status })
  }

  return (
    <>
      <PageHeader
        title="Weight Data"
        subtitle="Search, filter, and maintain Part / Node / Rack / Package weight records."
        actions={
          <button type="button" className="button" onClick={openAdd}>
            <Plus size={16} /> Add Record
          </button>
        }
      />
      <div className="content">
        <div className="filter-bar">
          <input
            placeholder="Search description, PN, people, config, supplier…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
          <select value={projectFilter} onChange={(e) => {
            setProjectFilter(e.target.value)
            setPage(1)
          }}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.code}>
                {p.code}
              </option>
            ))}
          </select>
          <select value={levelFilter} onChange={(e) => {
            setLevelFilter(e.target.value as Level | '')
            setPage(1)
          }}>
            <option value="">All levels</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => {
            setStatusFilter(e.target.value)
            setPage(1)
          }}>
            <option value="">All statuses</option>
            {RECORD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(e) => {
            setSourceFilter(e.target.value)
            setPage(1)
          }}>
            <option value="">All sources</option>
            {[
              'Internal Measurement',
              'Supplier',
              'Specification',
              'Estimated',
              'Unknown',
            ].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={buildPhaseFilter} onChange={(e) => {
            setBuildPhaseFilter(e.target.value)
            setPage(1)
          }}>
            <option value="">All build / phase</option>
            {buildPhaseOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="columns-menu">
            <button
              type="button"
              className="button secondary columns-trigger"
              aria-expanded={columnsOpen}
              onClick={() => setColumnsOpen((open) => !open)}
            >
              <Columns3 size={16} /> Columns
            </button>
            {columnsOpen ? (
              <div className="columns-dropdown">
                <div className="columns-dropdown-head">
                  <strong>Columns</strong>
                  <button type="button" className="button ghost" onClick={() => updateVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}>
                    Reset
                  </button>
                </div>
                <div className="columns-options">
                  {COLUMN_OPTIONS.map((column) => (
                    <label key={column.key} className={column.locked ? 'locked-column' : undefined}>
                      <input
                        type="checkbox"
                        checked={isVisible(column.key)}
                        disabled={column.locked}
                        onChange={() => toggleColumn(column.key)}
                      />
                      {column.label}{column.locked ? ' (always shown)' : ''}
                    </label>
                  ))}
                </div>
                <div className="columns-dropdown-actions">
                  <button type="button" className="button secondary" onClick={() => updateVisibleColumns(COLUMN_OPTIONS.map((column) => column.key))}>
                    Select All
                  </button>
                  <button type="button" className="button secondary" onClick={() => updateVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}>
                    Reset Default
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <span className="muted">{filtered.length} shown</span>
        </div>

        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {isVisible('project') ? <th className="weight-table-project">Project</th> : null}
                  {isVisible('description') ? <th className="weight-table-description">Description</th> : null}
                  {isVisible('lenovoPn') ? <th>Lenovo PN</th> : null}
                  {isVisible('customerPn') ? <th>MSFT PN</th> : null}
                  {isVisible('manufacturer') ? <th>Manufacturer</th> : null}
                  {isVisible('category') ? <th>Part Category</th> : null}
                  {isVisible('buildPhase') ? <th>Build / Phase</th> : null}
                  {isVisible('level') ? <th>Level</th> : null}
                  {isVisible('weight') ? <th>Weight (kg)</th> : null}
                  {isVisible('measuredDate') ? <th>Measured Date</th> : null}
                  {isVisible('note') ? <th>Note</th> : null}
                  {isVisible('source') ? <th>Source</th> : null}
                  {isVisible('measuredBy') ? <th>Measured By</th> : null}
                  {isVisible('status') ? <th>Status</th> : null}
                  {isVisible('reviewedBy') ? <th>Reviewed By</th> : null}
                  {isVisible('actions') ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {pageRecords.map((r) => (
                  <tr key={r.id}>
                    {isVisible('project') ? <td className="weight-table-project">{r.projectCode || '—'}</td> : null}
                    {isVisible('description') ? (
                      <td className="weight-table-description" title={r.description}>
                        <span className="description-text">{r.description || '—'}</span>
                      </td>
                    ) : null}
                    {isVisible('lenovoPn') ? <td>{r.lenovoPn || '—'}</td> : null}
                    {isVisible('customerPn') ? <td>{r.customerPn || '—'}</td> : null}
                    {isVisible('manufacturer') ? <td>{r.manufacturer || '—'}</td> : null}
                    {isVisible('category') ? <td>{r.category || '—'}</td> : null}
                    {isVisible('buildPhase') ? <td>{r.buildPhase || '—'}</td> : null}
                    {isVisible('level') ? <td>
                      <span className="badge level">{r.level}</span>
                    </td> : null}
                    {isVisible('weight') ? <td>{formatWeightKg(r)}</td> : null}
                    {isVisible('measuredDate') ? <td>{r.measuredDate || '—'}</td> : null}
                    {isVisible('note') ? <td className="weight-table-note" title={r.note || undefined}>{r.note || '—'}</td> : null}
                    {isVisible('source') ? <td>{r.source || '—'}</td> : null}
                    {isVisible('measuredBy') ? <td>{r.measuredBy || '—'}</td> : null}
                    {isVisible('status') ? <td>
                      <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                    </td> : null}
                    {isVisible('reviewedBy') ? <td>{r.reviewedBy || '—'}</td> : null}
                    {isVisible('actions') ? <td>
                      <div className="row-actions">
                        {r.status === 'Pending Review' ? (
                          <>
                            <button
                              type="button"
                              className="button ghost"
                              title="Verify"
                              onClick={() => applyReview(r, 'Verified')}
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              className="button ghost"
                              title="Need Recheck"
                              onClick={() => applyReview(r, 'Need Recheck')}
                            >
                              <RotateCcw size={15} />
                            </button>
                            <button
                              type="button"
                              className="button ghost"
                              title="Reject"
                              onClick={() => applyReview(r, 'Rejected')}
                            >
                              <X size={15} />
                            </button>
                          </>
                        ) : null}
                        <button type="button" className="button ghost" title="Edit" onClick={() => openEdit(r)}>
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          className="button ghost"
                          title="Duplicate"
                          onClick={() => duplicateRecord(r.id)}
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          type="button"
                          className="button ghost"
                          title="Delete"
                          onClick={() => {
                            if (confirm('Delete this weight record?')) deleteRecord(r.id)
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td> : null}
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="empty">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {filtered.length ? (
            <div className="table-pagination">
              <span className="muted">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} items
              </span>
              <div className="pagination-actions">
                <button type="button" className="button ghost" title="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  <ChevronLeft size={16} />
                </button>
                <span>{currentPage} / {pageCount}</span>
                <button type="button" className="button ghost" title="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <RecordFormModal
        open={showForm}
        projects={projects}
        initial={editing}
        defaultProjectId={
          projectFilter ? projects.find((p) => p.code === projectFilter)?.id : settings.defaultProjectId
        }
        defaultUnit={settings.defaultUnit}
        onClose={() => setShowForm(false)}
        onSave={upsertRecord}
      />
    </>
  )
}
