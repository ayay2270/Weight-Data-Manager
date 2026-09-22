from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Measurement


router = APIRouter(prefix="/api")


@router.get("/revision")
def revision(db: Session = Depends(get_db)):
    stamp, count, version_sum = db.execute(select(func.max(Measurement.updated_at), func.count(Measurement.id), func.coalesce(func.sum(Measurement.version), 0)).where(Measurement.is_deleted.is_(False))).one()
    return {"revision": f"{stamp.isoformat() if stamp else ''}:{count}:{version_sum}", "count": count}


@router.get("/measurements/{measurement_id}")
def measurement_json(measurement_id: int, db: Session = Depends(get_db)):
    m = db.get(Measurement, measurement_id)
    if not m or m.is_deleted:
        raise HTTPException(404, "Record not found")
    return {"id": m.id, "project": m.project.code, "level": m.level, "description": m.description, "weight_value": m.weight_value, "weight_unit": m.weight_unit, "value_type": m.value_type, "status": m.status, "updated_by": m.updated_by, "updated_at": m.updated_at.isoformat(), "version": m.version}

