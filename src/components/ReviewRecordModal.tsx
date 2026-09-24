import { useState } from 'react'
import { Check, RotateCcw, X } from 'lucide-react'
import type { RecordStatus, WeightRecord } from '../data/types'
import { formatWeightKg, todayDate } from '../utils/helpers'
import { Modal } from './Modal'

interface ReviewRecordModalProps {
  record: WeightRecord | null
  onClose: () => void
  onSave: (record: WeightRecord) => void
}

function show(value?: string | null): string {
  const text = value?.trim()
  return text ? text : '—'
}

const details = (record: WeightRecord) => [
  ['Project', record.projectCode || '—'],
  ['Build Phase', show(record.buildPhase)],
  ['Level', record.level],
  ['Description', show(record.description)],
  ['Lenovo PN', show(record.lenovoPn)],
  ['MSFT PN', show(record.customerPn)],
  ['Part Category', show(record.category)],
  ['Manufacturer', show(record.manufacturer)],
  ['Weight', formatWeightKg(record)],
  ['Configuration', show(record.configuration)],
  ['Source', record.source],
  ['Supplier / Data Provider', show(record.supplier)],
  ['Reference / Document Rev.', show(record.reference)],
  ['Measured By', show(record.measuredBy)],
  ['Measured Date', show(record.measuredDate)],
  ['Notes', show(record.note)],
  ['Current Status', record.status],
]

export function ReviewRecordModal({ record, onClose, onSave }: ReviewRecordModalProps) {
  const [reviewer, setReviewer] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!record) return null

  function submit(status: RecordStatus) {
    const needsComment = status === 'Need Recheck' || status === 'Rejected'
    if (!reviewer.trim()) {
      setError('Reviewer is required.')
      return
    }
    if (needsComment && !comment.trim()) {
      setError('Review Comment is required for Need Recheck or Reject.')
      return
    }
    onSave({
      ...record,
      status,
      reviewedBy: reviewer.trim(),
      reviewedDate: todayDate(),
      reviewComment: comment.trim() || null,
    } as WeightRecord)
    onClose()
  }

  return (
    <Modal
      title="Review Weight Record"
      onClose={onClose}
      footer={<button type="button" className="button secondary" onClick={onClose}>Cancel</button>}
    >
      {error ? <div className="alert error">{error}</div> : null}
      <div className="review-modal-grid">
        <section className="review-record-info">
          <h3>Record Information</h3>
          <dl>
            {details(record).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd title={value}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section className="review-controls">
          <label className="review-field">
            <span className="required-label">
              <span className="required-mark" aria-hidden="true">
                *
              </span>
              Reviewer
            </span>
            <input
              autoFocus
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="Engineer name"
            />
          </label>
          <label className="review-field">
            Review Comment
            <textarea
              maxLength={500}
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional for Verify; required for Need Recheck and Reject"
            />
            <small>{comment.length} / 500</small>
          </label>
          <div className="review-action-buttons">
            <button type="button" className="button review-verify" onClick={() => submit('Verified')}>
              <Check size={22} strokeWidth={2.5} />
              Verify
            </button>
            <button type="button" className="button review-recheck" onClick={() => submit('Need Recheck')}>
              <RotateCcw size={22} strokeWidth={2.5} />
              Need Recheck
            </button>
            <button type="button" className="button review-reject" onClick={() => submit('Rejected')}>
              <X size={22} strokeWidth={2.5} />
              Reject
            </button>
          </div>
        </section>
      </div>
    </Modal>
  )
}
