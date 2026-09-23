import { Pencil, RotateCcw, X } from 'lucide-react'
import type { WeightRecord } from '../data/types'
import { formatWeightKg, statusBadgeClass } from '../utils/helpers'

interface RecordDetailDrawerProps {
  record: WeightRecord | null
  onClose: () => void
  onEdit?: (record: WeightRecord) => void
  onReview?: (record: WeightRecord) => void
}

function Row({ label, value }: { label: string; value?: string | null }) {
  const display = value?.trim() ? value : '—'
  return (
    <div className="drawer-row">
      <dt>{label}</dt>
      <dd title={display}>{display}</dd>
    </div>
  )
}

export function RecordDetailDrawer({ record, onClose, onEdit, onReview }: RecordDetailDrawerProps) {
  if (!record) return null

  const isPending = record.status === 'Pending Review'
  const isRecheck = record.status === 'Need Recheck'

  return (
    <div className="drawer-backdrop" onClick={onClose} role="presentation">
      <aside
        className="record-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Weight Record Details"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="record-drawer-head">
          <div>
            <h2>Weight Record Details</h2>
            <p className="muted">{record.projectCode} · {record.description || 'Untitled'}</p>
          </div>
          <button type="button" className="button secondary" onClick={onClose} aria-label="Close drawer">
            <X size={16} />
          </button>
        </div>

        <div className="record-drawer-body">
          <section>
            <h3>Measurement Information</h3>
            <dl className="drawer-dl">
              <Row label="Project" value={record.projectCode} />
              <Row label="Build Phase" value={record.buildPhase} />
              <Row label="Level" value={record.level} />
              <Row label="Description" value={record.description} />
              <Row label="Lenovo PN" value={record.lenovoPn} />
              <Row label="Manufacturer" value={record.manufacturer} />
              <Row label="Weight" value={formatWeightKg(record)} />
              <Row label="Configuration" value={record.configuration} />
              <Row label="Source" value={record.source} />
              <Row label="Supplier" value={record.supplier} />
              <Row label="Reference" value={record.reference} />
              <Row label="Measured By" value={record.measuredBy} />
              <Row label="Measured Date" value={record.measuredDate} />
              <Row label="Notes" value={record.note} />
            </dl>
          </section>

          <section>
            <h3>Review Information</h3>
            <dl className="drawer-dl">
              <div className="drawer-row">
                <dt>Status</dt>
                <dd>
                  <span className={`badge ${statusBadgeClass(record.status)}`}>{record.status}</span>
                </dd>
              </div>
              <Row label="Reviewer" value={record.reviewedBy} />
              <Row label="Reviewed Date" value={record.reviewedDate} />
              <Row label="Review Comment" value={record.reviewComment} />
            </dl>
          </section>
        </div>

        <div className="record-drawer-foot">
          {isPending && onReview ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                onReview(record)
                onClose()
              }}
            >
              Review
            </button>
          ) : null}
          {isRecheck && onEdit ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                onEdit(record)
                onClose()
              }}
            >
              <RotateCcw size={15} /> Update Measurement
            </button>
          ) : null}
          {onEdit && !isRecheck ? (
            <button
              type="button"
              className="button secondary"
              onClick={() => {
                onEdit(record)
                onClose()
              }}
            >
              <Pencil size={15} /> Edit Record
            </button>
          ) : null}
          <button type="button" className="button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </div>
  )
}
