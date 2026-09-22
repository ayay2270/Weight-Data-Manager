from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, model_validator


class MeasurementInput(BaseModel):
    project: str = Field(min_length=1, max_length=80)
    level: str
    description: str = Field(min_length=1, max_length=500)
    lenovo_pn: Optional[str] = None
    customer_pn: Optional[str] = None
    manufacturer: Optional[str] = None
    category: Optional[str] = None
    weight_value: Optional[float] = None
    weight_unit: str
    value_type: str
    measured_date: Optional[date] = None
    measured_by: Optional[str] = None
    project_phase: Optional[str] = None
    data_source: str = "Internal"
    note: Optional[str] = None
    package_type: Optional[str] = None
    applicable_parent: Optional[str] = None
    supplier: Optional[str] = None
    combined_weight: bool = False

    @model_validator(mode="after")
    def validate_weight(self):
        if self.level not in {"Part", "Node", "Rack", "Package"}:
            raise ValueError("Invalid level")
        if self.value_type not in {"Measured", "Estimated", "TBD"}:
            raise ValueError("Invalid value type")
        if self.value_type in {"Measured", "Estimated"} and (self.weight_value is None or self.weight_value <= 0):
            raise ValueError("Measured or estimated weight must be greater than zero")
        if self.value_type == "TBD":
            self.weight_value = None
        return self

