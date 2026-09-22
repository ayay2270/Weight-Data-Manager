import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { useData } from '../hooks/useData'
import type { ExpectedItems, Project } from '../data/types'
import { emptyExpected, nowIso, percentLabel, projectCompleteness, uid } from '../utils/helpers'

export function ProjectsPage() {
  const { projects, records, upsertProject } = useData()
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState({
    code: '',
    name: '',
    phase: '',
    status: 'Active' as Project['status'],
    expectedItems: emptyExpected(),
    notes: '',
  })

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return projects
      .filter((p) => !q || p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [projects, query])

  function openCreate() {
    setEditing(null)
    setForm({
      code: '',
      name: '',
      phase: '',
      status: 'Active',
      expectedItems: { Part: 10, Node: 4, Rack: 1, Package: 0 },
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
      expectedItems: { ...project.expectedItems },
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
      expectedItems: form.expectedItems,
      notes: form.notes.trim() || null,
      createdAt: editing?.createdAt || stamp,
      updatedAt: stamp,
    })
    setShowForm(false)
  }

  function setExpected(key: keyof ExpectedItems, value: string) {
    const n = Math.max(0, Number(value) || 0)
    setForm((prev) => ({ ...prev, expectedItems: { ...prev.expectedItems, [key]: n } }))
  }

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle="Manage project codes and configurable expected item counts for completeness."
        actions={
          <button type="button" className="button" onClick={openCreate}>
            <Plus size={16} /> Add Project
          </button>
        }
      />
      <div className="content">
        <div className="filter-bar">
          <input
            placeholder="Search project code or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="panel">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Phase</th>
                  <th>Status</th>
                  <th>Records</th>
                  <th>Completeness</th>
                  <th>Expected (P/N/R/Pkg)</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project) => {
                  const projectRecords = records.filter((r) => r.projectId === project.id)
                  const { overall } = projectCompleteness(project.expectedItems, projectRecords)
                  const e = project.expectedItems
                  return (
                    <tr key={project.id}>
                      <td>
                        <Link to={`/projects/${project.id}`} style={{ color: 'var(--blue)', fontWeight: 700 }}>
                          {project.code}
                        </Link>
                      </td>
                      <td>{project.name}</td>
                      <td>{project.phase || '—'}</td>
                      <td>
                        <span className="badge">{project.status}</span>
                      </td>
                      <td>{projectRecords.length}</td>
                      <td>{percentLabel(overall)}</td>
                      <td>
                        {e.Part}/{e.Node}/{e.Rack}/{e.Package}
                      </td>
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
                    <td colSpan={8} className="empty">
                      No projects found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
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
              Project Code
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
              Name
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
            <label>
              Expected Part
              <input
                type="number"
                min={0}
                value={form.expectedItems.Part}
                onChange={(e) => setExpected('Part', e.target.value)}
              />
            </label>
            <label>
              Expected Node
              <input
                type="number"
                min={0}
                value={form.expectedItems.Node}
                onChange={(e) => setExpected('Node', e.target.value)}
              />
            </label>
            <label>
              Expected Rack
              <input
                type="number"
                min={0}
                value={form.expectedItems.Rack}
                onChange={(e) => setExpected('Rack', e.target.value)}
              />
            </label>
            <label>
              Expected Package
              <input
                type="number"
                min={0}
                value={form.expectedItems.Package}
                onChange={(e) => setExpected('Package', e.target.value)}
              />
            </label>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            Completeness = Collected (Pending Review + Verified with weight) ÷ Expected. Expected values are stored per
            project and are not hardcoded in dashboard components.
          </p>
        </Modal>
      ) : null}
    </>
  )
}
