import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LevelProgress } from '../components/LevelProgress'
import { PageHeader } from '../components/PageHeader'
import { useData } from '../hooks/useData'
import { LEVELS } from '../data/types'
import {
  countByLevel,
  formatDate,
  formatWeightKg,
  getWeightKg,
  percentLabel,
  projectCompleteness,
  statusBadgeClass,
} from '../utils/helpers'

export function ProjectDetailPage() {
  const { projectId } = useParams()
  const { projects, records } = useData()
  const project = projects.find((p) => p.id === projectId)

  const projectRecords = useMemo(
    () => records.filter((r) => r.projectId === projectId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [records, projectId],
  )

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

  const { collected, overall, byLevel } = projectCompleteness(project.expectedItems, projectRecords)
  const totals = countByLevel(projectRecords)
  const missing = projectRecords.filter((r) => r.status === 'Need Recheck' || r.weightValue == null)
  const latest = projectRecords.slice(0, 6)
  const totalKg = projectRecords.reduce((sum, r) => sum + (getWeightKg(r) || 0), 0)

  const gaps = LEVELS.flatMap((level) => {
    const shortfall = Math.max(0, project.expectedItems[level] - collected[level])
    if (shortfall <= 0) return []
    return [`${level}: need ${shortfall} more collected item(s)`]
  })

  return (
    <>
      <PageHeader
        title={`${project.code} · ${project.name}`}
        subtitle={`${project.phase || 'No phase'} · ${project.status}`}
        actions={
          <Link className="button secondary" to="/projects">
            All Projects
          </Link>
        }
      />
      <div className="content">
        <div className="cards">
          <div className="card blue">
            <span>Completeness</span>
            <strong>{percentLabel(overall)}</strong>
          </div>
          <div className="card green">
            <span>Records</span>
            <strong>{projectRecords.length}</strong>
          </div>
          <div className="card amber">
            <span>Total Mass</span>
            <strong style={{ fontSize: 22 }}>{totalKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong>
          </div>
          <div className="card slate">
            <span>Updated</span>
            <strong style={{ fontSize: 20 }}>{formatDate(project.updatedAt)}</strong>
          </div>
        </div>

        <div className="detail-grid">
          <div className="panel">
            <div className="panel-head">
              <h2>Project Info</h2>
            </div>
            <dl className="details">
              <dt>Code</dt>
              <dd>{project.code}</dd>
              <dt>Name</dt>
              <dd>{project.name}</dd>
              <dt>Phase</dt>
              <dd>{project.phase || '—'}</dd>
              <dt>Status</dt>
              <dd>{project.status}</dd>
              <dt>Notes</dt>
              <dd>{project.notes || '—'}</dd>
              <dt>Expected items</dt>
              <dd>
                Part {project.expectedItems.Part} · Node {project.expectedItems.Node} · Rack{' '}
                {project.expectedItems.Rack} · Package {project.expectedItems.Package}
              </dd>
            </dl>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>Completeness Breakdown</h2>
            </div>
            <LevelProgress expected={project.expectedItems} collected={collected} />
            <div style={{ marginTop: 16 }} className="muted">
              Part {percentLabel(byLevel.Part)} · Node {percentLabel(byLevel.Node)} · Rack{' '}
              {percentLabel(byLevel.Rack)} · Package {percentLabel(byLevel.Package)}
            </div>
          </div>
        </div>

        <div className="grid-2">
          <div className="panel">
            <div className="panel-head">
              <h2>Latest Records</h2>
              <Link className="button ghost" to={`/weight-data?project=${project.code}`}>
                Open table
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
                      <td className="description">{r.description}</td>
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
              <h2>Missing / Incomplete Items</h2>
            </div>
            <div className="missing-list">
              {gaps.map((g) => (
                <div className="missing-item" key={g}>
                  <span>{g}</span>
                  <span className="badge Need-Recheck">Gap</span>
                </div>
              ))}
              {missing.map((r) => (
                <div className="missing-item" key={r.id}>
                  <span>
                    <strong>{r.level}</strong> · {r.description}
                  </span>
                  <span className={`badge ${statusBadgeClass(r.status)}`}>{r.status}</span>
                </div>
              ))}
              {!gaps.length && !missing.length ? <div className="empty">No missing items for current targets.</div> : null}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Summary by Level</h2>
          </div>
          <div className="cards" style={{ marginBottom: 0 }}>
            {LEVELS.map((level) => (
              <div className="card" key={level}>
                <span>{level}</span>
                <strong>{totals[level]}</strong>
                <em>
                  Collected {collected[level]} / Expected {project.expectedItems[level]}
                </em>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
