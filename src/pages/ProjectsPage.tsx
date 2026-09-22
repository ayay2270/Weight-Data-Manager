import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Clock3,
  Database,
  FolderKanban,
  Plus,
} from 'lucide-react'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { useData } from '../hooks/useData'
import type { Project } from '../data/types'
import { emptyExpected, formatDate, nowIso, uid } from '../utils/helpers'

function projectUpdatedAt(project: Project, recordDates: string[]): string {
  const times = [project.updatedAt, ...recordDates].filter(Boolean)
  if (!times.length) return project.updatedAt
  return times.sort().at(-1) || project.updatedAt
}

export function ProjectsPage() {
  const { projects, records, upsertProject } = useData()
  const [query, setQuery] = useState('')
  const [phaseFilter, setPhaseFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState({
    code: '',
    name: '',
    phase: '',
    status: 'Active' as Project['status'],
    notes: '',
  })

  const activeProjects = useMemo(() => projects.filter((p) => p.status === 'Active'), [projects])
  const pendingReviewCount = records.filter((r) => r.status === 'Pending Review').length
  const verifiedCount = records.filter((r) => r.status === 'Verified').length

  const phaseOptions = useMemo(() => {
    return [...new Set(projects.map((p) => p.phase).filter(Boolean) as string[])].sort()
  }, [projects])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects
      .filter((p) => {
        if (phaseFilter && (p.phase || '') !== phaseFilter) return false
        if (statusFilter && p.status !== statusFilter) return false
        if (!q) return true
        return (
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.notes || '').toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [projects, query, phaseFilter, statusFilter])

  function openCreate() {
    setEditing(null)
    setForm({
      code: '',
      name: '',
      phase: '',
      status: 'Active',
      notes: '',
    })
    setShowForm(true)
  }

  function openEdit(project: Project) {
    setEditing(project)
    setForm({
      code: project.code,
      name: project.name,
      phase: project.phase || '',
      status: project.status,
      notes: project.notes || '',
    })
    setShowForm(true)
  }

  function saveProject() {
    if (!form.code.trim() || !form.name.trim()) return
    const stamp = nowIso()
    upsertProject({
      id: editing?.id || uid('prj'),
      code: form.code.trim(),
      name: form.name.trim(),
      phase: form.phase.trim() || null,
      status: form.status,
      expectedItems: editing?.expectedItems ? { ...editing.expectedItems } : emptyExpected(),
      notes: form.notes.trim() || null,
      createdAt: editing?.createdAt || stamp,
      updatedAt: stamp,
    })
    setShowForm(false)
  }

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Manage projects and review weight data collection status."
        actions={
          <button type="button" className="button" onClick={openCreate}>
            <Plus size={16} /> Add Project
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
              <span>Active Projects</span>
              <strong>{activeProjects.length}</strong>
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

        <div className="filter-bar">
          <input
            placeholder="Search project code or description..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={phaseFilter} onChange={(e) => setPhaseFilter(e.target.value)}>
            <option value="">All phases</option>
            {phaseOptions.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Description</th>
                  <th>Phase</th>
                  <th>Status</th>
                  <th>Records</th>
                  <th>Pending Review</th>
                  <th>Verified</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
                  const projectRecords = records.filter((r) => r.projectId === project.id)
                  const pending = projectRecords.filter((r) => r.status === 'Pending Review').length
                  const verified = projectRecords.filter((r) => r.status === 'Verified').length
                  const updated = projectUpdatedAt(
                    project,
                    projectRecords.map((r) => r.updatedAt),
                  )
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link to={`/projects/${project.id}`} style={{ color: 'var(--blue)', fontWeight: 700 }}>
                          {project.code}
                        </Link>
                      </td>
                      <td>{project.name || '—'}</td>
                      <td>{project.phase || '—'}</td>
                      <td>
                        <span className={`badge ${project.status}`}>{project.status}</span>
                      </td>
                      <td>{projectRecords.length}</td>
                      <td>{pending}</td>
                      <td>{verified}</td>
                      <td>{formatDate(updated)}</td>
                      <td>
                        <button type="button" className="button ghost" onClick={() => openEdit(project)}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!filtered.length ? (
                  <tr>
                    <td colSpan={9} className="empty">
                      No projects found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="muted" style={{ marginTop: 12, textAlign: 'right' }}>
            Showing {filtered.length} of {projects.length} projects
          </div>
        </div>
      </div>

      {showForm ? (
        <Modal
          title={editing ? 'Edit Project' : 'Add Project'}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <button type="button" className="button secondary" onClick={() => setShowForm(false)}>
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
            <label className="span-2">
              Description
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
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
    </>
  )
}
