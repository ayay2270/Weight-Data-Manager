import type { ExpectedItems, Level } from '../data/types'
import { LEVELS } from '../data/types'
import { percentLabel } from '../utils/helpers'

interface LevelProgressProps {
  expected: ExpectedItems
  collected: ExpectedItems
  title?: string
  subtitle?: string
}

function fillClass(ratio: number): string {
  if (ratio >= 0.9) return 'progress-fill good'
  if (ratio >= 0.5) return 'progress-fill'
  return 'progress-fill warn'
}

export function LevelProgress({ expected, collected, title, subtitle }: LevelProgressProps) {
  return (
    <div className="project-progress-card">
      {title ? <h3>{title}</h3> : null}
      {subtitle ? <p className="muted">{subtitle}</p> : null}
      <div className="progress-list">
        {LEVELS.map((level: Level) => {
          const exp = expected[level]
          const col = collected[level]
          const ratio = exp <= 0 ? (col > 0 ? 1 : 0) : Math.min(1, col / exp)
          return (
            <div className="progress-row" key={level}>
              <div>{level}</div>
              <div className="progress-track">
                <div className={fillClass(ratio)} style={{ width: `${ratio * 100}%` }} />
              </div>
              <div className="progress-meta">
                {col}/{exp} · {percentLabel(ratio)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
