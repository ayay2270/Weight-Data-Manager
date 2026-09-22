import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { RecordFormModal } from '../components/RecordFormModal'
import { useData } from '../hooks/useData'
import type { Level, WeightRecord } from '../data/types'
import { LEVELS } from '../data/types'
import { formatDate, formatWeightKg } from '../utils/helpers'

type Tab = 'All' | Level

export function WeightDataPage() {
  const { projects, records, settings, upsertRecord, deleteRecord, duplicateRecord } = useData()
  const [params] = useSearchParams()
  const [tab, setTab] = useState<Tab>('All')
  const [query, setQuery] = useState('')
  const [projectFilter, setProjectFilter] = useState(params.get('project') || '')
  const [statusFilter, setStatusFilter] = useState('')
  const [editing, setEditing] = useState<WeightRecord | null>(null)
  const [showForm, setShowForm] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return records
      .filter((r) => (tab === 'All' ? true : r.level === tab))
      .filter((r) => (projectFilter ? r.projectCode === projectFilter : true))
      .filter((r) => (statusFilter ? r.status === statusFilter : true))
      .filter((r) => {
        if (!q) return true
        return [r.description, r.lenovoPn, r.customerPn, r.manufacturer, r.category, r.projectCode]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [records, tab, projectFilter, statusFilter, query])

  function openAdd() {
    setEditing(null)
    setShowForm(true)
  }

  function openEdit(record: WeightRecord) {
    setEditing(record)
    setShowForm(true)
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
            placeholder="Search description, PN, manufacturer…"
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
            {['Draft', 'Measured', 'Verified', 'Estimated', 'Missing'].map((s) => (
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
                  <th>Project</th>
                  <th>Level</th>
                  <th>Description</th>
                  <th>Lenovo PN</th>
                  <th>Category</th>
                  <th>Weight (kg)</th>
                  <th>Date</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.projectCode}</td>
                    <td>
                      <span className="badge level">{r.level}</span>
                    </td>
                    <td className="description" title={r.description}>
                      {r.description}
                    </td>
                    <td>{r.lenovoPn || '—'}</td>
                    <td>{r.category || '—'}</td>
                    <td>{formatWeightKg(r)}</td>
                    <td>{formatDate(r.measuredDate)}</td>
                    <td>{r.source}</td>
                    <td>
                      <span className={`badge ${r.status}`}>{r.status}</span>
                    </td>
                    <td>
                      <div className="row-actions">
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
