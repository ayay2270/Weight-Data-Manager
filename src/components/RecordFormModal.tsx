import { useEffect, useMemo, useState } from 'react'
import type { DataSource, Level, Project, RecordStatus, WeightRecord, WeightUnit } from '../data/types'
import { DATA_SOURCES, LEVELS, RECORD_STATUSES } from '../data/types'
import { nowIso, toWeightKg, uid } from '../utils/helpers'
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
  level: 'Part' as Level,
  description: '',
  lenovoPn: '',
  customerPn: '',
  manufacturer: '',
  category: '',
  weightValue: '',
  weightUnit: 'g' as WeightUnit,
  measuredDate: '',
  source: 'Internal Measurement' as DataSource,
  status: 'Draft' as RecordStatus,
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

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({
        projectId: initial.projectId,
        level: initial.level,
        description: initial.description,
        lenovoPn: initial.lenovoPn || '',
        customerPn: initial.customerPn || '',
        manufacturer: initial.manufacturer || '',
        category: initial.category || '',
        weightValue: initial.weightValue != null ? String(initial.weightValue) : '',
        weightUnit: initial.weightUnit,
        measuredDate: initial.measuredDate || '',
        source: initial.source,
        status: initial.status,
        note: initial.note || '',
      })
    } else {
      const projectId = defaultProjectId || projects[0]?.id || ''
      const level: Level = 'Part'
      setForm({
        ...emptyForm,
        projectId,
        level,
        weightUnit: level === 'Part' ? 'g' : defaultUnit,
      })
    }
    setError(null)
  }, [open, initial, defaultProjectId, defaultUnit, projects])

  const showPartFields = form.level === 'Part' || form.level === 'Node' || form.level === 'Rack'
  const showPackageHint = form.level === 'Package'

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'Active' || p.id === form.projectId),
    [projects, form.projectId],
  )

  if (!open) return null

  function setLevel(level: Level) {
    setForm((prev) => {
      let weightUnit = prev.weightUnit
      if (level === 'Part') weightUnit = 'g'
      else if (prev.weightUnit === 'g') weightUnit = 'kg'
      return {
        ...prev,
        level,
        weightUnit,
        category: level === 'Package' && !prev.category ? 'Packaging' : prev.category,
      }
    })
  }

  function handleSave() {
    const project = projects.find((p) => p.id === form.projectId)
    if (!project) {
      setError('Please select a project.')
      return
    }
    if (!form.description.trim()) {
      setError('Description is required.')
      return
    }
    const weightValue =
      form.weightValue.trim() === '' ? null : Number(form.weightValue)
    if (form.weightValue.trim() !== '' && !Number.isFinite(weightValue)) {
      setError('Weight must be a valid number.')
      return
    }
    if (
      (form.status === 'Measured' || form.status === 'Verified' || form.status === 'Estimated') &&
      (weightValue == null || weightValue <= 0)
    ) {
      setError('Measured / Verified / Estimated records need a weight greater than zero.')
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
      weightKg: toWeightKg(weightValue, form.weightUnit),
      measuredDate: form.measuredDate || null,
      source: form.source,
      status: form.status,
      note: form.note.trim() || null,
      originalWeightText: initial?.originalWeightText || null,
      createdAt: initial?.createdAt || stamp,
      updatedAt: stamp,
    })
    onClose()
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
          <button type="button" className="button" onClick={handleSave}>
            Save Record
          </button>
        </>
      }
    >
      {error ? <div className="alert error">{error}</div> : null}
      <div className="form-grid">
        <label>
          Project
          <select
            value={form.projectId}
            onChange={(e) => setForm({ ...form, projectId: e.target.value })}
          >
            <option value="">Select project…</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>
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
          Description
          <input
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
          Customer / MSFT PN
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
              Category
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            </label>
          </>
        ) : null}
        {showPackageHint ? (
          <label className="span-2">
            Category
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="Packaging"
            />
          </label>
        ) : null}
        <label>
          Weight
          <input
            type="number"
            step="any"
            min="0"
            value={form.weightValue}
            onChange={(e) => setForm({ ...form, weightValue: e.target.value })}
          />
        </label>
        <label>
          Unit
          <select
            value={form.weightUnit}
            onChange={(e) => setForm({ ...form, weightUnit: e.target.value as WeightUnit })}
          >
            <option value="g">g</option>
            <option value="kg">kg</option>
          </select>
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
        <label>
          Status
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as RecordStatus })}
          >
            {RECORD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
