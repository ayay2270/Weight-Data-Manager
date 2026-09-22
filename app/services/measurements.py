from __future__ import annotations
import json
from datetime import date
from sqlalchemy import desc, func, or_, select, update
from sqlalchemy.orm import Session
from ..models import ActivityLog, Item, Measurement, Project, Review, utcnow
from ..schemas import MeasurementInput


LEVEL_THRESHOLD = {"Part": 10.0, "Node": 5.0, "Rack": 5.0, "Package": 5.0}


def clean_optional(value):
    if value is None:
        return None
    value = str(value).strip()
    return None if value.upper() in {"", "NA", "N/A", "NONE"} else value


def standard_g(value, unit):
    if value is None:
        return None
    return float(value) * (1000 if unit.lower() == "kg" else 1)


def snapshot(m: Measurement):
    fields = ["id", "project_id", "item_id", "level", "description", "lenovo_pn", "customer_pn", "manufacturer", "category", "weight_value", "weight_unit", "value_type", "measured_date", "measured_by", "project_phase", "data_source", "note", "package_type", "applicable_parent", "supplier", "combined_weight", "status", "updated_by", "version", "is_deleted"]
    return {k: (str(getattr(m, k)) if getattr(m, k) is not None else None) for k in fields}


def audit(db: Session, m: Measurement | None, action: str, before, after, user: str):
    db.add(ActivityLog(measurement=m, action=action, before_value=json.dumps(before, ensure_ascii=False) if before is not None else None, after_value=json.dumps(after, ensure_ascii=False) if after is not None else None, performed_by=user or "Unknown"))


def get_or_create_project(db: Session, code: str, phase=None):
    code = code.strip()
    project = db.scalar(select(Project).where(Project.code == code))
    if not project:
        project = Project(code=code, name=code, phase=phase)
        db.add(project)
        db.flush()
    return project


def get_or_create_item(db: Session, data: MeasurementInput):
    conditions = [Item.level == data.level]
    if clean_optional(data.lenovo_pn):
        conditions.append(Item.lenovo_pn == clean_optional(data.lenovo_pn))
    elif clean_optional(data.customer_pn):
        conditions.append(Item.customer_pn == clean_optional(data.customer_pn))
    else:
        conditions.append(Item.description == data.description.strip())
    item = db.scalar(select(Item).where(*conditions).limit(1))
    if not item:
        item = Item(level=data.level, description=data.description.strip(), lenovo_pn=clean_optional(data.lenovo_pn), customer_pn=clean_optional(data.customer_pn), manufacturer=clean_optional(data.manufacturer), category=clean_optional(data.category), package_type=clean_optional(data.package_type), applicable_parent=clean_optional(data.applicable_parent), supplier=clean_optional(data.supplier))
        db.add(item)
        db.flush()
    return item


def create_measurement(db: Session, data: MeasurementInput, user: str, status="Draft", import_fingerprint=None, original_value=None, import_note=None):
    project = get_or_create_project(db, data.project, data.project_phase)
    item = get_or_create_item(db, data)
    m = Measurement(project=project, item=item, level=data.level, description=data.description.strip(), lenovo_pn=clean_optional(data.lenovo_pn), customer_pn=clean_optional(data.customer_pn), manufacturer=clean_optional(data.manufacturer), category=clean_optional(data.category), weight_value=data.weight_value, weight_unit=data.weight_unit, weight_standard_g=standard_g(data.weight_value, data.weight_unit), value_type=data.value_type, measured_date=data.measured_date, measured_by=clean_optional(data.measured_by) or user, project_phase=clean_optional(data.project_phase), data_source=data.data_source, note=clean_optional(data.note), package_type=clean_optional(data.package_type), applicable_parent=clean_optional(data.applicable_parent), supplier=clean_optional(data.supplier), combined_weight=data.combined_weight, status=status, created_by=user, updated_by=user, import_fingerprint=import_fingerprint, original_value=original_value, import_note=import_note)
    db.add(m)
    db.flush()
    audit(db, m, "Create", None, snapshot(m), user)
    db.commit()
    return m


def update_measurement(db: Session, measurement_id: int, data: MeasurementInput, user: str, expected_version: int):
    current = db.get(Measurement, measurement_id)
    if not current or current.is_deleted:
        return None, "not_found"
    before = snapshot(current)
    project = get_or_create_project(db, data.project, data.project_phase)
    item = get_or_create_item(db, data)
    values = dict(project_id=project.id, item_id=item.id, level=data.level, description=data.description.strip(), lenovo_pn=clean_optional(data.lenovo_pn), customer_pn=clean_optional(data.customer_pn), manufacturer=clean_optional(data.manufacturer), category=clean_optional(data.category), weight_value=data.weight_value, weight_unit=data.weight_unit, weight_standard_g=standard_g(data.weight_value, data.weight_unit), value_type=data.value_type, measured_date=data.measured_date, measured_by=clean_optional(data.measured_by) or user, project_phase=clean_optional(data.project_phase), data_source=data.data_source, note=clean_optional(data.note), package_type=clean_optional(data.package_type), applicable_parent=clean_optional(data.applicable_parent), supplier=clean_optional(data.supplier), combined_weight=data.combined_weight, updated_by=user, updated_at=utcnow(), version=expected_version + 1)
    result = db.execute(update(Measurement).where(Measurement.id == measurement_id, Measurement.version == expected_version, Measurement.is_deleted.is_(False)).values(**values))
    if result.rowcount != 1:
        db.rollback()
        return db.get(Measurement, measurement_id), "conflict"
    db.flush()
    updated = db.get(Measurement, measurement_id)
    db.refresh(updated)
    audit(db, updated, "Edit", before, snapshot(updated), user)
    db.commit()
    return updated, None


def transition(db: Session, m: Measurement, action: str, user: str, comment=None):
    before = snapshot(m)
    targets = {"Submit": "Pending Review", "Approve": "Approved", "Return": "Returned", "Delete": m.status}
    if action == "Return" and not clean_optional(comment):
        raise ValueError("Return comment is required")
    if action == "Delete":
        m.is_deleted = True
    else:
        m.status = targets[action]
    m.updated_by = user
    m.updated_at = utcnow()
    m.version += 1
    if action in {"Approve", "Return"}:
        db.add(Review(measurement=m, reviewer=user, decision=action, comment=clean_optional(comment)))
    audit(db, m, action, before, snapshot(m), user)
    db.commit()
    return m


def previous_approved(db: Session, m: Measurement):
    return db.scalar(select(Measurement).where(Measurement.item_id == m.item_id, Measurement.id != m.id, Measurement.status == "Approved", Measurement.is_deleted.is_(False), Measurement.weight_standard_g.is_not(None), Measurement.measured_date <= (m.measured_date or date.max)).order_by(desc(Measurement.measured_date), desc(Measurement.id)).limit(1))


def comparison(db: Session, m: Measurement):
    prev = previous_approved(db, m)
    if not prev or m.weight_standard_g is None or prev.weight_standard_g in (None, 0):
        return {"previous": prev, "difference": None, "percent": None, "warning": False}
    diff_g = m.weight_standard_g - prev.weight_standard_g
    pct = diff_g / prev.weight_standard_g * 100
    diff_display = diff_g / (1000 if m.weight_unit == "kg" else 1)
    return {"previous": prev, "difference": diff_display, "percent": pct, "warning": abs(pct) > LEVEL_THRESHOLD[m.level]}


def apply_filters(stmt, project=None, level=None, category=None, status=None, value_type=None, data_source=None, search=None):
    if project: stmt = stmt.join(Measurement.project).where(Project.code == project)
    if level: stmt = stmt.where(Measurement.level == level)
    if category: stmt = stmt.where(Measurement.category == category)
    if status: stmt = stmt.where(Measurement.status == status)
    if value_type: stmt = stmt.where(Measurement.value_type == value_type)
    if data_source: stmt = stmt.where(Measurement.data_source == data_source)
    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(Measurement.description.ilike(term), Measurement.lenovo_pn.ilike(term), Measurement.customer_pn.ilike(term)))
    return stmt

