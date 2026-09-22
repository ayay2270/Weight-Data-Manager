import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, Copy, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { RecordFormModal } from '../components/RecordFormModal'
import { useData } from '../hooks/useData'
import type { Level, RecordStatus, WeightRecord } from '../data/types'
import { LEVELS, RECORD_STATUSES } from '../data/types'
import { formatWeightKg, statusBadgeClass, todayDate } from '../utils/helpers'

type Tab = 'All' | Level

export function WeightDataPage() {
  const { projects, records, settings, upsertRecord, deleteRecord, duplicateRecord } = useData()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>('All')
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState(params.get('project') || '')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [buildPhaseFilter, setBuildPhaseFilter] = useState('')
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
      .filter((r) => (tab === 'All' ? true : r.level === tab))
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
  }, [records, tab, projectFilter, statusFilter, sourceFilter, buildPhaseFilter, query])

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
        <div className="tabs">
          {(['All', ...LEVELS] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="filter-bar">
          <input
            placeholder="Search description, PN, people, config, supplier…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.code}>
                {p.code}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {RECORD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
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
          <select value={buildPhaseFilter} onChange={(e) => setBuildPhaseFilter(e.target.value)}>
            <option value="">All build / phase</option>
            {buildPhaseOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="muted">{filtered.length} shown</span>
        </div>

        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Project</th>
                  <th>Build / Phase</th>
                  <th>Level</th>
                  <th>Weight</th>
                  <th>Source</th>
                  <th>Measured By</th>
                  <th>Status</th>
                  <th>Reviewed By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td className="description" title={r.description}>
                      {r.description}
                    </td>
                    <td>{r.projectCode}</td>
                    <td>{r.buildPhase || '—'}</td>
                    <td>
                      <span className="badge level">{r.level}</span>
                    </td>
                    <td>{formatWeightKg(r)}</td>
                    <td>{r.source}</td>
                    <td>{r.measuredBy || '—'}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                    </td>
                    <td>{r.reviewedBy || '—'}</td>
                    <td>
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
                    </td>
                  </tr>
                ))}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={10} className="empty">
                      No records match the current filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
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
