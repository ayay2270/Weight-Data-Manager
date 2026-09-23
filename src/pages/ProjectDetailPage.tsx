import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Clock3, Database, Pencil } from 'lucide-react'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { RecordDetailDrawer } from '../components/RecordDetailDrawer'
import { RecordFormModal } from '../components/RecordFormModal'
import { ReviewRecordModal } from '../components/ReviewRecordModal'
import { useData } from '../hooks/useData'
import type { Project, RecordStatus, WeightRecord } from '../data/types'
import { LEVELS, RECORD_STATUSES } from '../data/types'
import {
  countByLevel,
  formatDate,
  formatWeightKg,
  nowIso,
  statusBadgeClass,
} from '../utils/helpers'

const STATUS_BAR_CLASS: Record<RecordStatus, string> = {
  Draft: 'draft',
  'Pending Review': 'pending',
  Verified: 'verified',
  Rejected: 'rejected',
  'Need Recheck': 'recheck',
}

export function ProjectDetailPage() {
  const { projectId } = useParams()
  const { projects, records, settings, upsertProject, upsertRecord } = useData()
  const project = projects.find((p) => p.id === projectId)
  const [showEdit, setShowEdit] = useState(false)
  const [form, setForm] = useState({
    code: '',
    phase: '',
    status: 'Active' as Project['status'],
    notes: '',
  })
  const [editingRecord, setEditingRecord] = useState<WeightRecord | null>(null)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [reviewing, setReviewing] = useState<WeightRecord | null>(null)
  const [viewing, setViewing] = useState<WeightRecord | null>(null)

  const projectRecords = useMemo(
    () => records.filter((r) => r.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [records, projectId],
  )

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(RECORD_STATUSES.map((s) => [s, 0])) as Record<RecordStatus, number>
    for (const record of projectRecords) {
      counts[record.status] = (counts[record.status] || 0) + 1
    }
    return counts
  }, [projectRecords])

  const pendingCount = statusCounts['Pending Review'] || 0
  const verifiedCount = statusCounts.Verified || 0
  const totals = countByLevel(projectRecords)
  const latest = projectRecords.slice(0, 6)
  const reviewQueue = projectRecords
    .filter((r) => r.status === 'Pending Review' || r.status === 'Need Recheck')
    .slice(0, 8)
  const updatedAt = useMemo(() => {
    if (!project) return null
    const times = [project.updatedAt, ...projectRecords.map((r) => r.updatedAt)].filter(Boolean)
    return times.sort().at(-1) || project.updatedAt
  }, [project, projectRecords])
  const maxStatus = Math.max(1, ...RECORD_STATUSES.map((s) => statusCounts[s] || 0))

  function openEdit() {
    if (!project) return
    setForm({
      code: project.code,
      phase: project.phase || '',
      status: project.status,
      notes: project.notes || '',
    })
    setShowEdit(true)
  }

  function saveProject() {
    if (!project || !form.code.trim()) return
    upsertProject({
      ...project,
      code: form.code.trim(),
      phase: form.phase.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      updatedAt: nowIso(),
    })
    setShowEdit(false)
  }

  if (!project) {
    return (
      <>
        <PageHeader title="Project not found" subtitle="This project id is not in local data." />
        <div className="content">
          <Link className="button" to="/projects">
            Back to Projects
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={project.code}
        subtitle={`${project.phase || 'No phase'} · ${project.status}`}
        actions={
          <>
            <button type="button" className="button" onClick={openEdit}>
              <Pencil size={16} /> Edit Project
            </button>
            <Link className="button secondary" to={`/weight-data?project=${encodeURIComponent(project.code)}`}>
              Open Weight Data
            </Link>
          </>
        }
      />
      <div className="content">
        <div className="cards dashboard-summary-cards">
          <div className="card slate dashboard-summary-card">
            <div className="dashboard-summary-icon">
              <Database size={18} />
            </div>
            <div>
              <span>Total Records</span>
              <strong>{projectRecords.length}</strong>
            </div>
          </div>
          <div className="card amber dashboard-summary-card">
            <div className="dashboard-summary-icon">
              <Clock3 size={18} />
            </div>
            <div>
              <span>Pending Review</span>
              <strong>{pendingCount}</strong>
            </div>
          </div>
          <div className="card green dashboard-summary-card">
            <div className="dashboard-summary-icon">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <span>Verified</span>
              <strong>{verifiedCount}</strong>
            </div>
          </div>
          <div className="card blue dashboard-summary-card">
            <div className="dashboard-summary-icon">
              <CalendarDays size={18} />
            </div>
            <div>
              <span>Updated</span>
              <strong style={{ fontSize: 22 }}>{formatDate(updatedAt)}</strong>
            </div>
          </div>
        </div>

        <div className="detail-grid">
          <div className="panel">
            <div className="panel-head">
              <h2>Project Info</h2>
            </div>
            <dl className="details">
              <dt>Project</dt>
              <dd>{project.code}</dd>
              <dt>Phase</dt>
              <dd>{project.phase || '—'}</dd>
              <dt>Status</dt>
              <dd>
                <span className={`badge ${project.status}`}>{project.status}</span>
              </dd>
              <dt>Notes</dt>
              <dd>{project.notes || '—'}</dd>
            </dl>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Record Status Overview</h2>
            </div>
            <div className="status-overview">
              {RECORD_STATUSES.map((status) => {
                const count = statusCounts[status] || 0
                const width = `${Math.round((count / maxStatus) * 100)}%`
                return (
                  <div key={status} className="status-overview-row">
                    <div className="status-overview-label">{status}</div>
                    <div className="status-overview-track">
                      <div
                        className={`status-overview-fill ${STATUS_BAR_CLASS[status]}`}
                        style={{ width: count ? width : '0%' }}
                      />
                    </div>
                    <div className="status-overview-count">{count}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h2>Latest Records</h2>
              <Link className="button ghost" to={`/weight-data?project=${encodeURIComponent(project.code)}`}>
                Open weight data →
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Description</th>
                    <th>Weight (kg)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <span className="badge level">{r.level}</span>
                      </td>
                      <td className="description" title={r.description}>
                        {r.description || '—'}
                      </td>
                      <td>{formatWeightKg(r)}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                  {!latest.length ? (
                    <tr>
                      <td colSpan={4} className="empty">
                        No records.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Review Queue</h2>
              <Link className="button ghost" to={`/weight-data?project=${encodeURIComponent(project.code)}`}>
                Open weight data →
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Level</th>
                    <th>Weight (kg)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewQueue.map((r) => (
                    <tr key={r.id}>
                      <td className="description" title={r.description}>
                        {r.description || '—'}
                      </td>
                      <td>
                        <span className="badge level">{r.level}</span>
                      </td>
                      <td>{formatWeightKg(r)}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                      </td>
                      <td>
                        <div className="dashboard-row-actions">
                          {r.status === 'Pending Review' ? (
                            <button type="button" className="button" onClick={() => setReviewing(r)}>
                              Review
                            </button>
                          ) : null}
                          {r.status === 'Need Recheck' ? (
                            <button
                              type="button"
                              className="button action-recheck"
                              onClick={() => {
                                setEditingRecord(r)
                                setShowRecordForm(true)
                              }}
                            >
                              Update Measurement
                            </button>
                          ) : null}
                          <button type="button" className="button ghost" onClick={() => setViewing(r)}>
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!reviewQueue.length ? (
                    <tr>
                      <td colSpan={5} className="empty">
                        No records waiting for review.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Summary by Level</h2>
            <p>Actual record counts for this project.</p>
          </div>
          <div className="level-summary-grid">
            {LEVELS.map((level, index) => (
              <div className={`level-summary-card tone-${index}`} key={level}>
                <span>{level}</span>
                <strong>
                  {totals[level]} {totals[level] === 1 ? 'record' : 'records'}
                </strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showEdit ? (
        <Modal
          title="Edit Project"
          onClose={() => setShowEdit(false)}
          footer={
            <>
              <button type="button" className="button secondary" onClick={() => setShowEdit(false)}>
                Cancel
              </button>
              <button type="button" className="button" onClick={saveProject}>
                Save Project
              </button>
            </>
          }
        >
          <div className="form-grid">
            <label>
              Project
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </label>
            <label>
              Status
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as Project['status'] })}
              >
                <option value="Active">Active</option>
                <option value="Archived">Archived</option>
              </select>
            </label>
            <label>
              Phase
              <input value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} />
            </label>
            <label>
              Notes
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </label>
          </div>
        </Modal>
      ) : null}
      <RecordFormModal
        open={showRecordForm}
        projects={projects}
        records={records}
        initial={editingRecord}
        defaultUnit={settings.defaultUnit}
        onClose={() => {
          setShowRecordForm(false)
          setEditingRecord(null)
        }}
        onSave={upsertRecord}
        onOpenExisting={(record) => {
          setShowRecordForm(false)
          setEditingRecord(null)
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
        onEdit={(record) => {
          if (record.status !== 'Draft' && record.status !== 'Need Recheck') return
          setEditingRecord(record)
          setShowRecordForm(true)
        }}
        onReview={(record) => setReviewing(record)}
      />
    </>
  )
}
