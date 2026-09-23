import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Clock3,
  Database,
  FolderKanban,
  Package,
  Plus,
  Server,
  Layers,
  Box,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { RecordDetailDrawer } from '../components/RecordDetailDrawer'
import { RecordFormModal } from '../components/RecordFormModal'
import { ReviewRecordModal } from '../components/ReviewRecordModal'
import type { Level, RecordStatus, WeightRecord } from '../data/types'
import { LEVELS } from '../data/types'
import { useData } from '../hooks/useData'
import {
  formatWeightKg,
  latestUpdated,
  statusBadgeClass,
} from '../utils/helpers'

const ATTENTION_STATUSES: RecordStatus[] = ['Pending Review', 'Need Recheck']
const ATTENTION_LIMIT = 8
const SNAPSHOT_LIMIT = 3
const RECENT_VERIFIED_LIMIT = 8

const LEVEL_ICONS: Record<Level, typeof Box> = {
  Part: Box,
  Node: Layers,
  Rack: Server,
  Package: Package,
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return trimmed.replace('T', ' ').slice(0, 16)
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function countByLevel(records: WeightRecord[]): Record<Level, number> {
  const counts = { Part: 0, Node: 0, Rack: 0, Package: 0 }
  for (const record of records) {
    counts[record.level] += 1
  }
  return counts
}

function countByStatus(records: WeightRecord[]): Partial<Record<RecordStatus, number>> {
  const counts: Partial<Record<RecordStatus, number>> = {}
  for (const record of records) {
    counts[record.status] = (counts[record.status] || 0) + 1
  }
  return counts
}

export function DashboardPage() {
  const { projects, records, settings, upsertRecord } = useData()
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState<WeightRecord | null>(null)
  const [reviewing, setReviewing] = useState<WeightRecord | null>(null)
  const [viewing, setViewing] = useState<WeightRecord | null>(null)

  const lastUpdated = latestUpdated({ version: 1, projects, records, settings })
  const pendingReviewCount = records.filter((r) => r.status === 'Pending Review').length
  const verifiedCount = records.filter((r) => r.status === 'Verified').length

  const attentionRecords = useMemo(() => {
    const rank = (status: RecordStatus) => (status === 'Need Recheck' ? 0 : 1)
    return [...records]
      .filter((r) => ATTENTION_STATUSES.includes(r.status))
      .sort((a, b) => {
        const byStatus = rank(a.status) - rank(b.status)
        if (byStatus !== 0) return byStatus
        return b.updatedAt.localeCompare(a.updatedAt)
      })
      .slice(0, ATTENTION_LIMIT)
  }, [records])

  const snapshotProjects = useMemo(() => {
    const active = projects.filter((p) => p.status === 'Active')
    const source = active.length ? active : projects
    return [...source]
      .sort((a, b) => {
        const aCount = records.filter((r) => r.projectId === a.id).length
        const bCount = records.filter((r) => r.projectId === b.id).length
        if (bCount !== aCount) return bCount - aCount
        return a.code.localeCompare(b.code)
      })
      .slice(0, SNAPSHOT_LIMIT)
  }, [projects, records])

  const recentVerified = useMemo(() => {
    return [...records]
      .filter((r) => r.status === 'Verified')
      .sort((a, b) => {
        const aKey = a.reviewedDate || a.updatedAt
        const bKey = b.reviewedDate || b.updatedAt
        return bKey.localeCompare(aKey)
      })
      .slice(0, RECENT_VERIFIED_LIMIT)
  }, [records])

  function openEdit(record: WeightRecord) {
    setEditing(record)
  }

  return (
    <>
      <PageHeader
        title="Weight Data Manager"
        subtitle="Track Part / Node / Rack / Package weight collection across engineering projects."
        actions={
          <button type="button" className="button" onClick={() => setShowAdd(true)}>
            <Plus size={16} /> Add Record
          </button>
        }
      />

      <div className="content">
        <div className="cards dashboard-summary-cards">
          <div className="card blue dashboard-summary-card">
            <div className="dashboard-summary-icon">
              <FolderKanban size={18} />
            </div>
            <div>
              <span>Projects</span>
              <strong>{projects.length}</strong>
            </div>
          </div>
          <div className="card slate dashboard-summary-card">
            <div className="dashboard-summary-icon">
              <Database size={18} />
            </div>
            <div>
              <span>Total Records</span>
              <strong>{records.length}</strong>
            </div>
          </div>
          <div className="card amber dashboard-summary-card">
            <div className="dashboard-summary-icon">
              <Clock3 size={18} />
            </div>
            <div>
              <span>Pending Review</span>
              <strong>{pendingReviewCount}</strong>
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
        </div>
        <div className="dashboard-last-updated muted">
          Last updated: {formatDateTime(lastUpdated)}
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Records Requiring Attention</h2>
              <p>Items waiting for engineer review or recheck.</p>
            </div>
            <Link className="button ghost" to="/weight-data">
              View all records →
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Description</th>
                  <th>Build / Phase</th>
                  <th>Weight</th>
                  <th>Measured By</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {attentionRecords.map((r) => (
                  <tr key={r.id}>
                    <td className="weight-table-project">{r.projectCode || '—'}</td>
                    <td className="description" title={r.description}>
                      {r.description || '—'}
                    </td>
                    <td>{r.buildPhase || '—'}</td>
                    <td>{formatWeightKg(r)}</td>
                    <td>{r.measuredBy || '—'}</td>
                    <td>
                      <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                    </td>
                    <td>
                      <div className="dashboard-row-actions">
                        {r.status === 'Pending Review' ? (
                          <>
                            <button type="button" className="button" onClick={() => setReviewing(r)}>
                              Review
                            </button>
                            <button type="button" className="button ghost" onClick={() => openEdit(r)}>
                              Edit
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className="button action-recheck" onClick={() => openEdit(r)}>
                              Update Measurement
                            </button>
                            <button type="button" className="button ghost" onClick={() => setViewing(r)}>
                              View
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!attentionRecords.length ? (
                  <tr>
                    <td colSpan={7} className="empty">
                      No records need attention.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Project Snapshot</h2>
              <p>Current record counts by level and review status.</p>
            </div>
            <Link className="button ghost" to="/projects">
              View all projects →
            </Link>
          </div>
          <div className="dashboard-project-grid">
            {snapshotProjects.map((project) => {
              const projectRecords = records.filter((r) => r.projectId === project.id)
              const byLevel = countByLevel(projectRecords)
              const byStatus = countByStatus(projectRecords)
              const statusRows: Array<{ status: RecordStatus; className: string }> = [
                { status: 'Pending Review', className: 'pending' },
                { status: 'Verified', className: 'verified' },
                { status: 'Need Recheck', className: 'recheck' },
              ]

              return (
                <div key={project.id} className="dashboard-project-card">
                  <div className="dashboard-project-card-head">
                    <strong>
                      {project.code} · {project.name}
                    </strong>
                    <span className="muted">Phase: {project.phase || '—'}</span>
                  </div>

                  <div className="dashboard-level-grid">
                    {LEVELS.map((level) => {
                      const Icon = LEVEL_ICONS[level]
                      return (
                        <div key={level} className="dashboard-level-item">
                          <Icon size={15} />
                          <div>
                            <span>{level}</span>
                            <strong>{byLevel[level]} records</strong>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="dashboard-project-card-foot">
                    <div>
                      <div className="dashboard-total">Total {projectRecords.length} records</div>
                      <Link className="button ghost" to={`/projects/${project.id}`}>
                        Open project →
                      </Link>
                    </div>
                    <ul className="dashboard-status-list">
                      {statusRows.map(({ status, className }) => {
                        const count = byStatus[status] || 0
                        if (!count) return null
                        return (
                          <li key={status} className={className}>
                            <span>{status}</span>
                            <strong>{count}</strong>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </div>
              )
            })}
            {!snapshotProjects.length ? <div className="empty">No projects yet.</div> : null}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Recent Verified Records</h2>
              <p>Latest records that completed engineer review.</p>
            </div>
            <Link className="button ghost" to="/weight-data">
              View all →
            </Link>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Description</th>
                  <th>Project</th>
                  <th>Weight</th>
                  <th>Reviewer</th>
                  <th>Verified At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentVerified.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                    </td>
                    <td className="description" title={r.description}>
                      {r.description || '—'}
                    </td>
                    <td>{r.projectCode || '—'}</td>
                    <td>{formatWeightKg(r)}</td>
                    <td>{r.reviewedBy || '—'}</td>
                    <td>{formatDateTime(r.reviewedDate || r.updatedAt)}</td>
                    <td>
                      <button type="button" className="button ghost" onClick={() => setViewing(r)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {!recentVerified.length ? (
                  <tr>
                    <td colSpan={7} className="empty">
                      No verified records yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <RecordFormModal
        open={showAdd || Boolean(editing)}
        projects={projects}
        records={records}
        initial={editing}
        defaultProjectId={settings.defaultProjectId}
        defaultUnit={settings.defaultUnit}
        onClose={() => {
          setShowAdd(false)
          setEditing(null)
        }}
        onSave={upsertRecord}
        onOpenExisting={(record) => {
          setShowAdd(false)
          setEditing(null)
          setViewing(record)
        }}
      />
      <ReviewRecordModal key={reviewing?.id || 'none'} record={reviewing} onClose={() => setReviewing(null)} onSave={upsertRecord} />
      <RecordDetailDrawer
        record={viewing}
        onClose={() => setViewing(null)}
        onEdit={openEdit}
        onReview={(record) => setReviewing(record)}
      />
    </>
  )
}
