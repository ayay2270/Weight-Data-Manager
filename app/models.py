from __future__ import annotations
from datetime import date, datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[Optional[str]] = mapped_column(String(200))
    phase: Mapped[Optional[str]] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    measurements: Mapped[list[Measurement]] = relationship(back_populates="project")


class Item(Base):
    __tablename__ = "items"
    id: Mapped[int] = mapped_column(primary_key=True)
    level: Mapped[str] = mapped_column(String(20), index=True)
    description: Mapped[str] = mapped_column(String(500), index=True)
    lenovo_pn: Mapped[Optional[str]] = mapped_column(String(120), index=True)
    customer_pn: Mapped[Optional[str]] = mapped_column(String(120), index=True)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(160))
    category: Mapped[Optional[str]] = mapped_column(String(120), index=True)
    package_type: Mapped[Optional[str]] = mapped_column(String(160))
    applicable_parent: Mapped[Optional[str]] = mapped_column(String(250))
    supplier: Mapped[Optional[str]] = mapped_column(String(160))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    measurements: Mapped[list[Measurement]] = relationship(back_populates="item")
    __table_args__ = (Index("ix_item_identity", "level", "lenovo_pn", "customer_pn", "description"),)


class Measurement(Base):
    __tablename__ = "measurements"
    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), index=True)
    level: Mapped[str] = mapped_column(String(20), index=True)
    description: Mapped[str] = mapped_column(String(500), index=True)
    lenovo_pn: Mapped[Optional[str]] = mapped_column(String(120), index=True)
    customer_pn: Mapped[Optional[str]] = mapped_column(String(120), index=True)
    manufacturer: Mapped[Optional[str]] = mapped_column(String(160))
    category: Mapped[Optional[str]] = mapped_column(String(120), index=True)
    weight_value: Mapped[Optional[float]] = mapped_column(Float, index=True)
    weight_unit: Mapped[str] = mapped_column(String(10), default="kg")
    weight_standard_g: Mapped[Optional[float]] = mapped_column(Float)
    value_type: Mapped[str] = mapped_column(String(20), default="Measured", index=True)
    measured_date: Mapped[Optional[date]] = mapped_column(Date)
    measured_by: Mapped[Optional[str]] = mapped_column(String(100))
    project_phase: Mapped[Optional[str]] = mapped_column(String(100))
    data_source: Mapped[str] = mapped_column(String(20), default="Internal", index=True)
    note: Mapped[Optional[str]] = mapped_column(Text)
    package_type: Mapped[Optional[str]] = mapped_column(String(160))
    applicable_parent: Mapped[Optional[str]] = mapped_column(String(250))
    supplier: Mapped[Optional[str]] = mapped_column(String(160))
    combined_weight: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(30), default="Draft", index=True)
    created_by: Mapped[str] = mapped_column(String(100), default="Unknown")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_by: Mapped[str] = mapped_column(String(100), default="Unknown")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1)
    original_value: Mapped[Optional[str]] = mapped_column(Text)
    import_note: Mapped[Optional[str]] = mapped_column(Text)
    import_fingerprint: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    project: Mapped[Project] = relationship(back_populates="measurements")
    item: Mapped[Item] = relationship(back_populates="measurements")
    reviews: Mapped[list[Review]] = relationship(back_populates="measurement", cascade="all, delete-orphan")
    activities: Mapped[list[ActivityLog]] = relationship(back_populates="measurement")
    __table_args__ = (Index("ix_measurement_list", "is_deleted", "project_id", "level", "status"),)


class Review(Base):
    __tablename__ = "reviews"
    id: Mapped[int] = mapped_column(primary_key=True)
    measurement_id: Mapped[int] = mapped_column(ForeignKey("measurements.id"), index=True)
    reviewer: Mapped[str] = mapped_column(String(100))
    decision: Mapped[str] = mapped_column(String(20))
    comment: Mapped[Optional[str]] = mapped_column(Text)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    measurement: Mapped[Measurement] = relationship(back_populates="reviews")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    measurement_id: Mapped[Optional[int]] = mapped_column(ForeignKey("measurements.id"), index=True)
    action: Mapped[str] = mapped_column(String(40), index=True)
    before_value: Mapped[Optional[str]] = mapped_column(Text)
    after_value: Mapped[Optional[str]] = mapped_column(Text)
    performed_by: Mapped[str] = mapped_column(String(100))
    performed_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    measurement: Mapped[Optional[Measurement]] = relationship(back_populates="activities")


class ImportBatch(Base):
    __tablename__ = "import_batches"
    id: Mapped[int] = mapped_column(primary_key=True)
    file_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    filename: Mapped[str] = mapped_column(String(255))
    imported_by: Mapped[str] = mapped_column(String(100))
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    result_json: Mapped[str] = mapped_column(Text)

