import { useEffect, useMemo, useRef, useState } from 'react'
import type { DataSource, Level, Project, RecordStatus, WeightRecord, WeightUnit } from '../data/types'
import { DATA_SOURCES, LEVELS, RECORD_STATUSES } from '../data/types'
import { nowIso, todayDate, toWeightKg, uid } from '../utils/helpers'
import { Modal } from './Modal'

interface RecordFormModalProps {
  open: boolean
  projects: Project[]
  initial?: WeightRecord | null
  defaultProjectId?: string | null
  defaultUnit?: WeightUnit
  onClose: () => void
  onSave: (record: WeightRecord) => void
}

const emptyForm = {
  projectId: '',
  buildPhase: '',
  level: 'Part' as Level,
  description: '',
  lenovoPn: '',
  customerPn: '',
  manufacturer: '',
  category: '',
  weightValue: '',
  weightUnit: 'g' as WeightUnit,
  configuration: '',
  source: 'Internal Measurement' as DataSource,
  supplier: '',
  reference: '',
  measuredBy: '',
  measuredDate: '',
  status: 'Draft' as RecordStatus,
  reviewedBy: '',
  reviewedDate: '',
  reviewComment: '',
  note: '',
}

export function RecordFormModal({
  open,
  projects,
  initial,
  defaultProjectId,
  defaultUnit = 'kg',
  onClose,
  onSave,
}: RecordFormModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        projectId: initial.projectId,
        buildPhase: initial.buildPhase || '',
        level: initial.level,
        description: initial.description,
        lenovoPn: initial.lenovoPn || '',
        customerPn: initial.customerPn || '',
        manufacturer: initial.manufacturer || '',
        category: initial.category || '',
        weightValue: initial.weightValue != null ? String(initial.weightValue) : '',
        weightUnit: initial.weightUnit,
        configuration: initial.configuration || '',
        source: initial.source,
        supplier: initial.supplier || '',
        reference: initial.reference || '',
        measuredBy: initial.measuredBy || '',
        measuredDate: initial.measuredDate || '',
        status: initial.status,
        reviewedBy: initial.reviewedBy || '',
        reviewedDate: initial.reviewedDate || '',
        reviewComment: initial.reviewComment || '',
        note: initial.note || '',
      })
    } else {
      const projectId = defaultProjectId || projects[0]?.id || ''
      const project = projects.find((p) => p.id === projectId)
      const level: Level = 'Part'
      setForm({
        ...emptyForm,
        projectId,
        buildPhase: project?.phase || '',
        level,
        weightUnit: level === 'Part' ? 'g' : defaultUnit,
      })
    }
    setError(null)
    setSuccess(null)
  }, [open, initial, defaultProjectId, defaultUnit, projects])

  const showPartFields = form.level === 'Part' || form.level === 'Node' || form.level === 'Rack'
  const showPackageHint = form.level === 'Package'
  const showSupplierEmphasis = form.source === 'Supplier'
  const convertedKg = form.weightValue.trim() === '' ? null : toWeightKg(Number(form.weightValue), form.weightUnit)

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'Active' || p.id === form.projectId),
    [projects, form.projectId],
  )

  if (!open) return null

  function setLevel(level: Level) {
    setForm((prev) => ({
      ...prev,
      level,
      category: level === 'Package' && !prev.category ? 'Packaging' : prev.category,
    }))
  }

  function setProject(projectId: string) {
    setForm((prev) => {
      const project = projects.find((p) => p.id === projectId)
      // Only default Build / Phase from project when creating a new record.
      if (initial) return { ...prev, projectId }
      return {
        ...prev,
        projectId,
        buildPhase: project?.phase || '',
      }
    })
  }

  function setStatus(status: RecordStatus) {
    setForm((prev) => ({
      ...prev,
      status,
      reviewedDate:
        status === 'Verified' && !prev.reviewedDate.trim() ? todayDate() : prev.reviewedDate,
    }))
  }

  function handleSave(addNext = false) {
    const project = projects.find((p) => p.id === form.projectId)
    if (!project) {
      setError('Please select a project.')
      return
    }
    if (!form.description.trim()) {
      setError('Description is required.')
      return
    }
    const weightValue = form.weightValue.trim() === '' ? null : Number(form.weightValue)
    if (form.weightValue.trim() !== '' && !Number.isFinite(weightValue)) {
      setError('Weight must be a valid number.')
      return
    }
    if (
      (form.status === 'Pending Review' || form.status === 'Verified') &&
      (weightValue == null || weightValue <= 0)
    ) {
      setError('Pending Review / Verified records need a weight greater than zero.')
      return
    }
    if (form.status === 'Verified' && !form.reviewedBy.trim()) {
      setError('Reviewed By is required when Status is Verified.')
      return
    }

    const stamp = nowIso()
    onSave({
      id: initial?.id || uid('rec'),
      projectId: project.id,
      projectCode: project.code,
      level: form.level,
      description: form.description.trim(),
      lenovoPn: form.lenovoPn.trim() || null,
      customerPn: form.customerPn.trim() || null,
      manufacturer: showPartFields ? form.manufacturer.trim() || null : null,
      category: form.category.trim() || (form.level === 'Package' ? 'Packaging' : null),
      weightValue,
      weightUnit: form.weightUnit,
      weight_kg: toWeightKg(weightValue, form.weightUnit),
      buildPhase: form.buildPhase.trim() || null,
      configuration: form.configuration.trim() || null,
      supplier: form.supplier.trim() || null,
      reference: form.reference.trim() || null,
      measuredBy: form.measuredBy.trim() || null,
      measuredDate: form.measuredDate || null,
      source: form.source,
      status: form.status,
      reviewedBy: form.reviewedBy.trim() || null,
      reviewedDate: form.reviewedDate || null,
      reviewComment: form.reviewComment.trim() || null,
      note: form.note.trim() || null,
      originalWeightText: initial?.originalWeightText || null,
      createdAt: initial?.createdAt || stamp,
      updatedAt: stamp,
    })
    if (!addNext || initial) {
      onClose()
      return
    }
    setForm((prev) => ({
      ...emptyForm,
      projectId: prev.projectId,
      buildPhase: prev.buildPhase,
      level: prev.level,
      source: prev.source,
      measuredBy: prev.measuredBy,
      measuredDate: prev.measuredDate,
      weightUnit: prev.level === 'Part' ? 'g' : prev.weightUnit,
    }))
    setError(null)
    setSuccess('Record saved.')
    window.setTimeout(() => descriptionRef.current?.focus(), 0)
  }

  return (
    <Modal
      title={initial ? 'Edit Weight Record' : 'Add Weight Record'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button" onClick={() => handleSave()}>
            Save
          </button>
          {!initial ? <button type="button" className="button" onClick={() => handleSave(true)}>Save & Add Next</button> : null}
        </>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}
      {success ? <div className="alert success">{success}</div> : null}
      <div className="form-grid">
        <label>
          Project
          <select value={form.projectId} onChange={(e) => setProject(e.target.value)}>
            <option value="">Select project…</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Build / Phase
          <input
            value={form.buildPhase}
            onChange={(e) => setForm({ ...form, buildPhase: e.target.value })}
            placeholder="e.g. DV, PVT"
          />
        </label>
        <label>
          Level
          <select value={form.level} onChange={(e) => setLevel(e.target.value as Level)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label className="span-2">
          Part Description
          <input
            ref={descriptionRef}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Part / node / rack / package description"
          />
        </label>
        <label>
          Lenovo PN
          <input value={form.lenovoPn} onChange={(e) => setForm({ ...form, lenovoPn: e.target.value })} />
        </label>
        <label>
          MSFT / Customer PN
          <input value={form.customerPn} onChange={(e) => setForm({ ...form, customerPn: e.target.value })} />
        </label>
        {showPartFields ? (
          <>
            <label>
              Manufacturer
              <input
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
              />
            </label>
            <label>
              Part Category
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </label>
          </>
        ) : null}
        {showPackageHint ? (
          <label className="span-2">
            Part Category
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Packaging"
            />
          </label>
        ) : null}

        <label className="span-2">
          Weight
          <div className="weight-input">
            <input
              type="number"
              step="any"
              min="0"
              value={form.weightValue}
              onChange={(e) => setForm({ ...form, weightValue: e.target.value })}
            />
            <select
              aria-label="Weight unit"
              value={form.weightUnit}
              onChange={(e) => setForm({ ...form, weightUnit: e.target.value as WeightUnit })}
            >
              <option value="g">g</option>
              <option value="kg">kg</option>
            </select>
          </div>
          <small className="weight-preview">
            Converted: {convertedKg != null && Number.isFinite(convertedKg) ? `${convertedKg.toFixed(3)} kg` : '—'}
          </small>
        </label>

        <label className="span-2">
          Configuration / Included Items
          <input
            value={form.configuration}
            onChange={(e) => setForm({ ...form, configuration: e.target.value })}
            placeholder="e.g. Full rack + pallet, Bare motherboard"
          />
        </label>

        <label>
          Source
          <select
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value as DataSource })}
          >
            {DATA_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className={showSupplierEmphasis ? undefined : 'soft-field'}>
          Supplier / Data Provider
          <input
            value={form.supplier}
            onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            placeholder="e.g. Bromake, Guangda"
          />
        </label>
        <label className={`span-2${showSupplierEmphasis ? '' : ' soft-field'}`}>
          Reference / Document Rev.
          <input
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            placeholder="e.g. PKG Weight List Rev.B"
          />
        </label>

        <label>
          Measured By
          <input
            value={form.measuredBy}
            onChange={(e) => setForm({ ...form, measuredBy: e.target.value })}
            placeholder="Tester name"
          />
        </label>
        <label>
          Measured Date
          <input
            type="date"
            value={form.measuredDate}
            onChange={(e) => setForm({ ...form, measuredDate: e.target.value })}
          />
        </label>

        <label>
          Status
          <select value={form.status} onChange={(e) => setStatus(e.target.value as RecordStatus)}>
            {RECORD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reviewed By
          <input
            value={form.reviewedBy}
            onChange={(e) => setForm({ ...form, reviewedBy: e.target.value })}
            placeholder="Engineer name"
          />
        </label>
        <label>
          Reviewed Date
          <input
            type="date"
            value={form.reviewedDate}
            onChange={(e) => setForm({ ...form, reviewedDate: e.target.value })}
          />
        </label>
        <label className="span-2">
          Review Comment
          <textarea
            rows={2}
            maxLength={500}
            value={form.reviewComment}
            onChange={(e) => setForm({ ...form, reviewComment: e.target.value })}
          />
        </label>

        <label className="span-2">
          Note
          <textarea
            rows={3}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
      </div>
    </Modal>
  )
}
