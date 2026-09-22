import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Plus, Upload } from 'lucide-react'
import { LevelProgress } from '../components/LevelProgress'
import { PageHeader } from '../components/PageHeader'
import { RecordFormModal } from '../components/RecordFormModal'
import { useData } from '../hooks/useData'
import {
  collectedByLevel,
  formatDate,
  formatWeightKg,
  getWeightKg,
  latestUpdated,
  overallDataCompleteness,
  percentLabel,
  projectCompleteness,
  statusBadgeClass,
} from '../utils/helpers'

export function DashboardPage() {
  const { projects, records, settings, upsertRecord } = useData()
  const [showAdd, setShowAdd] = useState(false)

  const activeProjects = useMemo(() => projects.filter((p) => p.status === 'Active'), [projects])
  const completeness = overallDataCompleteness({
    version: 1,
    projects,
    records,
    settings,
  })
  const lastUpdated = latestUpdated({ version: 1, projects, records, settings })

  const distribution = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of records) {
      const weightKg = getWeightKg(r)
      if (weightKg == null) continue
      map.set(r.level, (map.get(r.level) || 0) + weightKg)
    }
    return ['Part', 'Node', 'Rack', 'Package'].map((level) => ({
      level,
      kg: Number((map.get(level) || 0).toFixed(2)),
    }))
  }, [records])

  const recent = useMemo(
    () => [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8),
    [records],
  )

  return (
    <>
      <PageHeader
        title="Weight Data Manager"
        subtitle="Track Part / Node / Rack / Package weight collection across engineering projects."
        actions={
          <>
            <button type="button" className="button" onClick={() => setShowAdd(true)}>
              <Plus size={16} /> Add Record
            </button>
            <Link className="button secondary" to="/import-export">
              <Upload size={16} /> Import Data
            </Link>
          </>
        }
      />
      <div className="content">
        <div className="cards">
          <div className="card blue">
            <span>Active Projects</span>
            <strong>{activeProjects.length}</strong>
          </div>
          <div className="card green">
            <span>Weight Records</span>
            <strong>{records.length}</strong>
          </div>
          <div className="card amber">
            <span>Data Completeness</span>
            <strong>{percentLabel(completeness)}</strong>
            <em>Collected ÷ Expected</em>
          </div>
          <div className="card slate">
            <span>Last Updated</span>
            <strong style={{ fontSize: 20 }}>{formatDate(lastUpdated)}</strong>
            <em>{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}</em>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Project Data Collection Progress</h2>
              <p>Part / Node / Rack / Package bars — completeness uses each project&apos;s expected item targets.</p>
            </div>
          </div>
          <div className="project-progress-grid">
            {activeProjects.map((project) => {
              const projectRecords = records.filter((r) => r.projectId === project.id)
              const { collected } = projectCompleteness(project.expectedItems, projectRecords)
              return (
                <div key={project.id} className="panel" style={{ marginBottom: 0, boxShadow: 'none' }}>
                  <LevelProgress
                    title={`${project.code} · ${project.name}`}
                    subtitle={`${project.phase || 'No phase'} · ${projectRecords.length} records`}
                    expected={project.expectedItems}
                    collected={collected}
                  />
                  <div style={{ marginTop: 10 }}>
                    <Link className="button ghost" to={`/projects/${project.id}`}>
                      Open project →
                    </Link>
                  </div>
                </div>
              )
            })}
            {!activeProjects.length ? <div className="empty">No active projects.</div> : null}
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h2>Weight Distribution</h2>
              <p>Total measured mass by level (kg)</p>
            </div>
            <div style={{ width: '100%', height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5eaf0" />
                  <XAxis dataKey="level" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="kg" fill="#2563a6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Recent Weight Records</h2>
              <Link className="button ghost" to="/weight-data">
                View all
              </Link>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Level</th>
                    <th>Description</th>
                    <th>Weight (kg)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id}>
                      <td>{r.projectCode}</td>
                      <td>
                        <span className="badge level">{r.level}</span>
                      </td>
                      <td className="description" title={r.description}>
                        {r.description}
                      </td>
                      <td>{formatWeightKg(r)}</td>
                      <td>
                        <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                  {!recent.length ? (
                    <tr>
                      <td colSpan={5} className="empty">
                        No records yet.
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
            <h2>Portfolio Level Snapshot</h2>
            <p>Collected vs expected across all active projects</p>
          </div>
          <LevelProgress
            expected={activeProjects.reduce(
              (acc, p) => ({
                Part: acc.Part + p.expectedItems.Part,
                Node: acc.Node + p.expectedItems.Node,
                Rack: acc.Rack + p.expectedItems.Rack,
                Package: acc.Package + p.expectedItems.Package,
              }),
              { Part: 0, Node: 0, Rack: 0, Package: 0 },
            )}
            collected={collectedByLevel(records.filter((r) => activeProjects.some((p) => p.id === r.projectId)))}
          />
        </div>
      </div>

      <RecordFormModal
        open={showAdd}
        projects={projects}
        defaultProjectId={settings.defaultProjectId}
        defaultUnit={settings.defaultUnit}
        onClose={() => setShowAdd(false)}
        onSave={upsertRecord}
      />
    </>
  )
}
