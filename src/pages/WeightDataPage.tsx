import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Copy,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Save,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { RecordDetailDrawer } from '../components/RecordDetailDrawer'
import { RecordFormModal } from '../components/RecordFormModal'
import { ReviewRecordModal } from '../components/ReviewRecordModal'
import { Modal } from '../components/Modal'
import { useData } from '../hooks/useData'
import type { Level, WeightRecord } from '../data/types'
import { LEVELS, RECORD_STATUSES } from '../data/types'
import { saveExportContext } from '../utils/exportContext'
import { formatWeightKg, getWeightKg, statusBadgeClass } from '../utils/helpers'

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
  | 'reviewComment'
  | 'updated'
  | 'actions'

const COLUMN_STORAGE_KEY = 'weightDataVisibleColumns'
const VIEWS_STORAGE_KEY = 'weightDataSavedViews'
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
  { key: 'reviewComment', label: 'Review Comment' },
  { key: 'updated', label: 'Updated' },
  { key: 'actions', label: 'Actions' },
]

/** Summary columns — full detail lives in the Record Detail Drawer. */
const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'project',
  'description',
  'lenovoPn',
  'level',
  'weight',
  'status',
  'actions',
]

type SortKey = 'project' | 'description' | 'weight' | 'measuredDate' | 'status' | 'updated'
type SortDirection = 'asc' | 'desc'
type SavedView = {
  id: string
  name: string
  isDefault?: boolean
  state: {
    query: string
    projectFilter: string
    levelFilter: Level | ''
    statusFilter: string
    sourceFilter: string
    buildPhaseFilter: string
    visibleColumns: ColumnKey[]
    sortKey: SortKey | null
    sortDirection: SortDirection | null
  }
}

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

function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as SavedView[]) : []
  } catch {
    return []
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
  const [savedViews, setSavedViews] = useState<SavedView[]>(loadSavedViews)
  const [selectedViewId, setSelectedViewId] = useState('all')
  const [showManageViews, setShowManageViews] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection | null>(null)
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<WeightRecord | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [reviewing, setReviewing] = useState<WeightRecord | null>(null)
  const [viewing, setViewing] = useState<WeightRecord | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

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
      .sort((a, b) => {
        if (!sortKey || !sortDirection) return b.updatedAt.localeCompare(a.updatedAt)
        const direction = sortDirection === 'asc' ? 1 : -1
        const field = (record: WeightRecord): string | number => {
          switch (sortKey) {
            case 'project':
              return record.projectCode || ''
            case 'description':
              return record.description || ''
            case 'weight':
              return getWeightKg(record) ?? -1
            case 'measuredDate':
              return record.measuredDate || ''
            case 'status':
              return record.status || ''
            case 'updated':
              return record.updatedAt || ''
          }
        }
        const left = field(a)
        const right = field(b)
        return typeof left === 'number' && typeof right === 'number'
          ? (left - right) * direction
          : String(left).localeCompare(String(right)) * direction
      })
  }, [records, levelFilter, projectFilter, statusFilter, sourceFilter, buildPhaseFilter, query, sortKey, sortDirection])

  useEffect(() => {
    saveExportContext(
      filtered.map((r) => r.id),
      selectedIds.filter((id) => filtered.some((r) => r.id === id)),
    )
  }, [filtered, selectedIds])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => records.some((r) => r.id === id)))
  }, [records])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRecords = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const isVisible = (key: ColumnKey) => visibleColumns.includes(key)
  const pageSelectedCount = pageRecords.filter((r) => selectedIds.includes(r.id)).length
  const allPageSelected = pageRecords.length > 0 && pageSelectedCount === pageRecords.length

  function updateVisibleColumns(next: ColumnKey[]) {
    const normalized = [...new Set<ColumnKey>(['project', 'description', ...next])]
    setVisibleColumns(normalized)
    localStorage.setItem(COLUMN_STORAGE_KEY, JSON.stringify(normalized))
  }

  function toggleColumn(key: ColumnKey) {
    if (key === 'project' || key === 'description') return
    updateVisibleColumns(isVisible(key) ? visibleColumns.filter((column) => column !== key) : [...visibleColumns, key])
  }

  function currentViewState(): SavedView['state'] {
    return {
      query,
      projectFilter,
      levelFilter,
      statusFilter,
      sourceFilter,
      buildPhaseFilter,
      visibleColumns,
      sortKey,
      sortDirection,
    }
  }

  function persistViews(next: SavedView[]) {
    setSavedViews(next)
    localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(next))
  }

  function applyView(viewId: string) {
    setSelectedViewId(viewId)
    if (viewId === 'all') {
      setQuery('')
      setProjectFilter('')
      setLevelFilter('')
      setStatusFilter('')
      setSourceFilter('')
      setBuildPhaseFilter('')
      setSortKey(null)
      setSortDirection(null)
      updateVisibleColumns(DEFAULT_VISIBLE_COLUMNS)
      setPage(1)
      return
    }
    const view = savedViews.find((item) => item.id === viewId)
    if (!view) return
    const state = view.state
    setQuery(state.query)
    setProjectFilter(state.projectFilter)
    setLevelFilter(state.levelFilter)
    setStatusFilter(state.statusFilter)
    setSourceFilter(state.sourceFilter)
    setBuildPhaseFilter(state.buildPhaseFilter)
    setSortKey(state.sortKey)
    setSortDirection(state.sortDirection)
    updateVisibleColumns(state.visibleColumns)
    setPage(1)
  }

  function saveCurrentView() {
    const name = newViewName.trim()
    if (!name) return
    const view: SavedView = { id: crypto.randomUUID(), name, state: currentViewState() }
    persistViews([...savedViews, view])
    setSelectedViewId(view.id)
    setNewViewName('')
  }

  function cycleSort(key: SortKey) {
    setPage(1)
    if (sortKey !== key) {
      setSortKey(key)
      setSortDirection('asc')
    } else if (sortDirection === 'asc') {
      setSortDirection('desc')
    } else {
      setSortKey(null)
      setSortDirection(null)
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return <ArrowUpDown size={13} />
    return sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />
  }

  function sortableHeader(label: string, key: SortKey, className?: string) {
    return (
      <th className={className}>
        <button type="button" className="sort-header" onClick={() => cycleSort(key)}>
          {label} {sortIcon(key)}
        </button>
      </th>
    )
  }

  function openAdd() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(record: WeightRecord) {
    setEditing(record)
    setShowForm(true)
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleSelectPage() {
    if (allPageSelected) {
      const pageIds = new Set(pageRecords.map((r) => r.id))
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)))
      return
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageRecords.map((r) => r.id)])])
  }

  const colSpan = visibleColumns.length + 1

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
        <div className="saved-views-bar">
          <label>
            Saved Views
            <select value={selectedViewId} onChange={(e) => applyView(e.target.value)}>
              <option value="all">All Records (Default)</option>
              {savedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                  {view.isDefault ? ' (Default)' : ''}
                </option>
              ))}
            </select>
          </label>
          <input
            className="saved-view-name"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
            placeholder="New view name"
            aria-label="New saved view name"
          />
          <button type="button" className="button secondary" disabled={!newViewName.trim()} onClick={saveCurrentView}>
            <Save size={15} /> Save Current View
          </button>
          <button type="button" className="button secondary" onClick={() => setShowManageViews(true)}>
            Manage Views
          </button>
        </div>
        <div className="filter-bar">
          <input
            placeholder="Search description, PN, people, config, supplier…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPage(1)
            }}
          />
          <select
            value={projectFilter}
            onChange={(e) => {
              setProjectFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.code}>
                {p.code}
              </option>
            ))}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => {
              setLevelFilter(e.target.value as Level | '')
              setPage(1)
            }}
          >
            <option value="">All levels</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All statuses</option>
            {RECORD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => {
              setSourceFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All sources</option>
            {['Internal Measurement', 'Supplier', 'Specification', 'Estimated', 'Unknown'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            value={buildPhaseFilter}
            onChange={(e) => {
              setBuildPhaseFilter(e.target.value)
              setPage(1)
            }}
          >
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
                      {column.label}
                      {column.locked ? ' (always shown)' : ''}
                    </label>
                  ))}
                </div>
                <div className="columns-dropdown-actions">
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => updateVisibleColumns(COLUMN_OPTIONS.map((column) => column.key))}
                  >
                    Select All
                  </button>
                  <button type="button" className="button secondary" onClick={() => updateVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}>
                    Reset Default
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <span className="muted">
            {filtered.length} shown
            {selectedIds.length ? ` · ${selectedIds.length} selected` : ''}
          </span>
        </div>

        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="select-col">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectPage}
                      aria-label="Select all rows on this page"
                    />
                  </th>
                  {isVisible('project') ? sortableHeader('Project', 'project', 'weight-table-project') : null}
                  {isVisible('description') ? sortableHeader('Description', 'description', 'weight-table-description') : null}
                  {isVisible('lenovoPn') ? <th>Lenovo PN</th> : null}
                  {isVisible('customerPn') ? <th>MSFT PN</th> : null}
                  {isVisible('manufacturer') ? <th>Manufacturer</th> : null}
                  {isVisible('category') ? <th>Part Category</th> : null}
                  {isVisible('buildPhase') ? <th>Build / Phase</th> : null}
                  {isVisible('level') ? <th>Level</th> : null}
                  {isVisible('weight') ? sortableHeader('Weight (kg)', 'weight') : null}
                  {isVisible('measuredDate') ? sortableHeader('Measured Date', 'measuredDate') : null}
                  {isVisible('note') ? <th>Note</th> : null}
                  {isVisible('source') ? <th>Source</th> : null}
                  {isVisible('measuredBy') ? <th>Measured By</th> : null}
                  {isVisible('status') ? sortableHeader('Status', 'status') : null}
                  {isVisible('reviewedBy') ? <th>Reviewed By</th> : null}
                  {isVisible('reviewComment') ? <th>Review Comment</th> : null}
                  {isVisible('updated') ? sortableHeader('Updated', 'updated') : null}
                  {isVisible('actions') ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {pageRecords.map((r) => (
                  <tr key={r.id} className={selectedIds.includes(r.id) ? 'row-selected' : undefined}>
                    <td className="select-col">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        aria-label={`Select ${r.description || r.id}`}
                      />
                    </td>
                    {isVisible('project') ? <td className="weight-table-project">{r.projectCode || '—'}</td> : null}
                    {isVisible('description') ? (
                      <td className="weight-table-description" title={r.description}>
                        <button type="button" className="linkish" onClick={() => setViewing(r)}>
                          {r.description || '—'}
                        </button>
                      </td>
                    ) : null}
                    {isVisible('lenovoPn') ? <td>{r.lenovoPn || '—'}</td> : null}
                    {isVisible('customerPn') ? <td>{r.customerPn || '—'}</td> : null}
                    {isVisible('manufacturer') ? <td>{r.manufacturer || '—'}</td> : null}
                    {isVisible('category') ? <td>{r.category || '—'}</td> : null}
                    {isVisible('buildPhase') ? <td>{r.buildPhase || '—'}</td> : null}
                    {isVisible('level') ? (
                      <td>
                        <span className="badge level">{r.level}</span>
                      </td>
                    ) : null}
                    {isVisible('weight') ? <td>{formatWeightKg(r)}</td> : null}
                    {isVisible('measuredDate') ? <td>{r.measuredDate || '—'}</td> : null}
                    {isVisible('note') ? (
                      <td className="weight-table-note" title={r.note || undefined}>
                        {r.note || '—'}
                      </td>
                    ) : null}
                    {isVisible('source') ? <td>{r.source || '—'}</td> : null}
                    {isVisible('measuredBy') ? <td>{r.measuredBy || '—'}</td> : null}
                    {isVisible('status') ? (
                      <td>
                        <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                      </td>
                    ) : null}
                    {isVisible('reviewedBy') ? <td>{r.reviewedBy || '—'}</td> : null}
                    {isVisible('reviewComment') ? (
                      <td className="review-comment" title={r.reviewComment || undefined}>
                        {r.reviewComment
                          ? r.reviewComment.length > 28
                            ? `${r.reviewComment.slice(0, 28)}…`
                            : r.reviewComment
                          : '—'}
                      </td>
                    ) : null}
                    {isVisible('updated') ? <td>{r.updatedAt.slice(0, 10)}</td> : null}
                    {isVisible('actions') ? (
                      <td>
                        <div className="row-actions">
                          <button type="button" className="button ghost" title="View" onClick={() => setViewing(r)}>
                            <Eye size={15} />
                          </button>
                          {r.status === 'Pending Review' ? (
                            <button
                              type="button"
                              className="button ghost"
                              title="Review"
                              onClick={() => setReviewing(r)}
                            >
                              <Check size={15} />
                            </button>
                          ) : null}
                          {r.status === 'Need Recheck' ? (
                            <button
                              type="button"
                              className="button ghost"
                              title="Update Measurement"
                              onClick={() => openEdit(r)}
                            >
                              <RotateCcw size={15} />
                            </button>
                          ) : (
                            <button type="button" className="button ghost" title="Edit" onClick={() => openEdit(r)}>
                              <Pencil size={15} />
                            </button>
                          )}
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
                      </td>
                    ) : null}
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={colSpan} className="empty">
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
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of{' '}
                {filtered.length} items
              </span>
              <div className="pagination-actions">
                <button
                  type="button"
                  className="button ghost"
                  title="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  className="button ghost"
                  title="Next page"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
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
        records={records}
        initial={editing}
        defaultProjectId={
          projectFilter ? projects.find((p) => p.code === projectFilter)?.id : settings.defaultProjectId
        }
        defaultUnit={settings.defaultUnit}
        onClose={() => setShowForm(false)}
        onSave={upsertRecord}
        onOpenExisting={(record) => {
          setShowForm(false)
          setViewing(record)
        }}
      />
      <ReviewRecordModal
        key={reviewing?.id || 'none'}
        record={reviewing}
        onClose={() => setReviewing(null)}
        onSave={upsertRecord}
      />
      <RecordDetailDrawer
        record={viewing}
        onClose={() => setViewing(null)}
        onEdit={openEdit}
        onReview={(record) => setReviewing(record)}
      />
      {showManageViews ? (
        <Modal
          title="Manage Saved Views"
          onClose={() => setShowManageViews(false)}
          footer={
            <button type="button" className="button secondary" onClick={() => setShowManageViews(false)}>
              Close
            </button>
          }
        >
          <div className="saved-views-manager">
            <div className="saved-view-row locked">
              <strong>All Records</strong>
              <span className="muted">Default · always available</span>
            </div>
            {savedViews.map((view) => (
              <div className="saved-view-row" key={view.id}>
                <input
                  value={view.name}
                  onChange={(e) =>
                    persistViews(
                      savedViews.map((item) => (item.id === view.id ? { ...item, name: e.target.value } : item)),
                    )
                  }
                />
                <button
                  type="button"
                  className="button ghost"
                  onClick={() =>
                    persistViews(savedViews.map((item) => ({ ...item, isDefault: item.id === view.id })))
                  }
                >
                  {view.isDefault ? 'Default' : 'Set Default'}
                </button>
                <button
                  type="button"
                  className="button danger"
                  onClick={() => {
                    const next = savedViews.filter((item) => item.id !== view.id)
                    persistViews(next)
                    if (selectedViewId === view.id) applyView('all')
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
            {!savedViews.length ? <div className="empty">No saved views yet.</div> : null}
          </div>
        </Modal>
      ) : null}
    </>
  )
}
