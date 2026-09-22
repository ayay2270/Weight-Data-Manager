from __future__ import annotations
import csv, io, math, tempfile
from datetime import date
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from fastapi.templating import Jinja2Templates
from openpyxl import Workbook
from sqlalchemy import asc, desc, func, select
from sqlalchemy.orm import Session, joinedload
from ..config import BASE_DIR, settings
from ..database import get_db
from ..models import ActivityLog, Measurement, Project
from ..schemas import MeasurementInput
from ..services.importer import import_excel
from ..services.measurements import apply_filters, comparison, create_measurement, transition, update_measurement


router = APIRouter()
templates = Jinja2Templates(directory=str(BASE_DIR / "app" / "templates"))


def ctx(request: Request, **kwargs):
    return {"request": request, "poll_seconds": settings.poll_seconds, **kwargs}


def choices(db):
    return {
        "projects": db.scalars(select(Project).order_by(Project.code)).all(),
        "categories": db.scalars(select(Measurement.category).where(Measurement.category.is_not(None), Measurement.is_deleted.is_(False)).distinct().order_by(Measurement.category)).all(),
    }


def parse_input(form):
    raw_weight = (form.get("weight_value") or "").strip()
    return MeasurementInput(project=form.get("project", ""), level=form.get("level", ""), description=form.get("description", ""), lenovo_pn=form.get("lenovo_pn"), customer_pn=form.get("customer_pn"), manufacturer=form.get("manufacturer"), category=form.get("category"), weight_value=float(raw_weight) if raw_weight else None, weight_unit=form.get("weight_unit", "kg"), value_type=form.get("value_type", "Measured"), measured_date=date.fromisoformat(form["measured_date"]) if form.get("measured_date") else None, measured_by=form.get("measured_by"), project_phase=form.get("project_phase"), data_source=form.get("data_source", "Internal"), note=form.get("note"), package_type=form.get("package_type"), applicable_parent=form.get("applicable_parent"), supplier=form.get("supplier"), combined_weight=form.get("combined_weight") == "on")


@router.get("/", response_class=HTMLResponse)
def dashboard(request: Request, project: str = "", level: str = "", status: str = "", search: str = "", db: Session = Depends(get_db)):
    base = select(Measurement).where(Measurement.is_deleted.is_(False))
    filtered = apply_filters(base, project=project or None, level=level or None, status=status or None, search=search or None)
    records = db.scalars(filtered.options(joinedload(Measurement.project)).order_by(desc(Measurement.updated_at)).limit(12)).all()
    all_active = Measurement.is_deleted.is_(False)
    stats = {
        "total": db.scalar(select(func.count()).select_from(Measurement).where(all_active)),
        "pending": db.scalar(select(func.count()).select_from(Measurement).where(all_active, Measurement.status == "Pending Review")),
        "approved": db.scalar(select(func.count()).select_from(Measurement).where(all_active, Measurement.status == "Approved")),
        "missing": db.scalar(select(func.count()).select_from(Measurement).where(all_active, Measurement.value_type == "TBD")),
    }
    return templates.TemplateResponse(request, "dashboard.html", ctx(request, records=records, stats=stats, filters={"project":project,"level":level,"status":status,"search":search}, **choices(db)))


@router.get("/records", response_class=HTMLResponse)
def records(request: Request, project: str="", level: str="", category: str="", status: str="", value_type: str="", data_source: str="", search: str="", sort: str="updated_at", direction: str="desc", page: int=1, db: Session=Depends(get_db)):
    page=max(page,1); allowed={"project":"project_id","level":"level","description":"description","lenovo_pn":"lenovo_pn","category":"category","weight":"weight_standard_g","measured_date":"measured_date","status":"status","updated_at":"updated_at"}; column=getattr(Measurement,allowed.get(sort,"updated_at"))
    stmt=apply_filters(select(Measurement).where(Measurement.is_deleted.is_(False)),project,level,category,status,value_type,data_source,search)
    count_stmt=apply_filters(select(func.count()).select_from(Measurement).where(Measurement.is_deleted.is_(False)),project,level,category,status,value_type,data_source,search)
    total=db.scalar(count_stmt); order=asc(column) if direction=="asc" else desc(column)
    rows=db.scalars(stmt.options(joinedload(Measurement.project)).order_by(order,desc(Measurement.id)).offset((page-1)*settings.page_size).limit(settings.page_size)).all()
    filters=dict(project=project,level=level,category=category,status=status,value_type=value_type,data_source=data_source,search=search,sort=sort,direction=direction)
    return templates.TemplateResponse(request,"records.html",ctx(request,records=rows,filters=filters,page=page,pages=max(1,math.ceil(total/settings.page_size)),total=total,**choices(db)))


@router.get("/records/new", response_class=HTMLResponse)
def new_record(request:Request,db:Session=Depends(get_db)):
    return templates.TemplateResponse(request,"record_form.html",ctx(request,record=None,errors=None,today=date.today().isoformat(),**choices(db)))


@router.post("/records/new")
async def add_record(request:Request,db:Session=Depends(get_db)):
    form=await request.form(); user=(form.get("current_user") or "Unknown").strip()
    try:
        m=create_measurement(db,parse_input(form),user)
        return RedirectResponse(f"/records/{m.id}?message=Record+created",303)
    except Exception as exc:
        db.rollback(); return templates.TemplateResponse(request,"record_form.html",ctx(request,record=None,errors=str(exc),form=dict(form),today=date.today().isoformat(),**choices(db)),status_code=422)


@router.get("/records/{measurement_id}", response_class=HTMLResponse)
def detail(measurement_id:int,request:Request,message:str="",db:Session=Depends(get_db)):
    m=db.scalar(select(Measurement).where(Measurement.id==measurement_id,Measurement.is_deleted.is_(False)).options(joinedload(Measurement.project),joinedload(Measurement.reviews)))
    if not m: raise HTTPException(404,"Record not found")
    history=db.scalars(select(Measurement).where(Measurement.item_id==m.item_id,Measurement.id!=m.id,Measurement.is_deleted.is_(False)).order_by(desc(Measurement.measured_date),desc(Measurement.id))).all()
    return templates.TemplateResponse(request,"record_detail.html",ctx(request,record=m,history=history,comparison=comparison(db,m),message=message))


@router.get("/records/{measurement_id}/edit", response_class=HTMLResponse)
def edit_form(measurement_id:int,request:Request,db:Session=Depends(get_db)):
    m=db.get(Measurement,measurement_id)
    if not m or m.is_deleted: raise HTTPException(404,"Record not found")
    return templates.TemplateResponse(request,"record_form.html",ctx(request,record=m,errors=None,today=date.today().isoformat(),**choices(db)))


@router.post("/records/{measurement_id}/edit")
async def edit_record(measurement_id:int,request:Request,db:Session=Depends(get_db)):
    form=await request.form(); user=(form.get("current_user") or "Unknown").strip(); expected=int(form.get("version","0"))
    try: data=parse_input(form)
    except Exception as exc: return templates.TemplateResponse(request,"error.html",ctx(request,title="Invalid data",message=str(exc),back_url=f"/records/{measurement_id}/edit"),status_code=422)
    m,error=update_measurement(db,measurement_id,data,user,expected)
    if error=="conflict": return templates.TemplateResponse(request,"conflict.html",ctx(request,record=m),status_code=409)
    if error: raise HTTPException(404,"Record not found")
    return RedirectResponse(f"/records/{m.id}?message=Record+updated",303)


@router.post("/records/{measurement_id}/action")
async def record_action(measurement_id:int,request:Request,db:Session=Depends(get_db)):
    form=await request.form(); m=db.get(Measurement,measurement_id)
    if not m or m.is_deleted: raise HTTPException(404,"Record not found")
    action=form.get("action"); user=(form.get("current_user") or "Unknown").strip(); comment=form.get("comment")
    try: transition(db,m,action,user,comment)
    except ValueError as exc: return templates.TemplateResponse(request,"error.html",ctx(request,title="Action required",message=str(exc),back_url=f"/records/{measurement_id}"),status_code=422)
    return RedirectResponse("/review" if action in {"Approve","Return"} else f"/records/{measurement_id}",303)


@router.get("/review", response_class=HTMLResponse)
def review_queue(request:Request,db:Session=Depends(get_db)):
    rows=db.scalars(select(Measurement).where(Measurement.status=="Pending Review",Measurement.is_deleted.is_(False)).options(joinedload(Measurement.project)).order_by(Measurement.updated_at)).all()
    warnings={m.id:comparison(db,m) for m in rows}
    return templates.TemplateResponse(request,"review.html",ctx(request,records=rows,warnings=warnings))


@router.get("/summary", response_class=HTMLResponse)
def summary(request:Request,project:str="",db:Session=Depends(get_db)):
    projects=db.scalars(select(Project).order_by(Project.code)).all(); selected=project or (projects[0].code if projects else "")
    rows=[]
    for level in ["Part","Node","Rack","Package"]:
        base=[Measurement.is_deleted.is_(False),Measurement.level==level,Measurement.project.has(code=selected)]
        rows.append({"level":level,"total":db.scalar(select(func.count()).select_from(Measurement).where(*base)),"approved":db.scalar(select(func.count()).select_from(Measurement).where(*base,Measurement.status=="Approved")),"pending":db.scalar(select(func.count()).select_from(Measurement).where(*base,Measurement.status=="Pending Review")),"returned":db.scalar(select(func.count()).select_from(Measurement).where(*base,Measurement.status=="Returned")),"tbd":db.scalar(select(func.count()).select_from(Measurement).where(*base,Measurement.value_type=="TBD")),"latest":db.scalar(select(func.max(Measurement.measured_date)).where(*base))})
    return templates.TemplateResponse(request,"summary.html",ctx(request,rows=rows,projects=projects,selected=selected))


@router.get("/import-export", response_class=HTMLResponse)
def import_export_page(request:Request,db:Session=Depends(get_db)):
    return templates.TemplateResponse(request,"import_export.html",ctx(request,result=None,**choices(db)))


@router.post("/import-export/import", response_class=HTMLResponse)
async def import_upload(request:Request,file:UploadFile=File(...),current_user:str=Form("Unknown"),db:Session=Depends(get_db)):
    if not file.filename.lower().endswith(".xlsx"): return templates.TemplateResponse(request,"error.html",ctx(request,title="Unsupported file",message="Please upload an .xlsx file.",back_url="/import-export"),status_code=422)
    with tempfile.NamedTemporaryFile(delete=False,suffix=".xlsx") as tmp:
        tmp.write(await file.read()); temp_path=tmp.name
    try: result=import_excel(db,temp_path,current_user)
    finally: Path(temp_path).unlink(missing_ok=True)
    return templates.TemplateResponse(request,"import_export.html",ctx(request,result=result,**choices(db)))


def export_rows(db,project="",level="",status="",data_source=""):
    stmt=apply_filters(select(Measurement).where(Measurement.is_deleted.is_(False)),project=project or None,level=level or None,status=status or None,data_source=data_source or None)
    return db.scalars(stmt.options(joinedload(Measurement.project)).order_by(Measurement.id)).all()


EXPORT_HEADERS=["ID","Project","Level","Description","Lenovo PN","Customer PN","Manufacturer","Category","Weight","Unit","Value Type","Measured Date","Measured By","Status","Data Source","Updated By","Updated At","Note"]
def export_values(m): return [m.id,m.project.code,m.level,m.description,m.lenovo_pn,m.customer_pn,m.manufacturer,m.category,m.weight_value,m.weight_unit,m.value_type,m.measured_date,m.measured_by,m.status,m.data_source,m.updated_by,m.updated_at,m.note]


@router.get("/export.csv")
def export_csv(project:str="",level:str="",status:str="",data_source:str="",db:Session=Depends(get_db)):
    output=io.StringIO(); writer=csv.writer(output); writer.writerow(EXPORT_HEADERS); writer.writerows(export_values(m) for m in export_rows(db,project,level,status,data_source))
    return StreamingResponse(iter(["\ufeff"+output.getvalue()]),media_type="text/csv",headers={"Content-Disposition":"attachment; filename=weight_records.csv"})


@router.get("/export.xlsx")
def export_xlsx(project:str="",level:str="",status:str="",data_source:str="",db:Session=Depends(get_db)):
    wb=Workbook(); ws=wb.active; ws.title="Weight Records"; ws.append(EXPORT_HEADERS)
    for m in export_rows(db,project,level,status,data_source): ws.append(export_values(m))
    for cell in ws[1]: cell.font=cell.font.copy(bold=True)
    ws.freeze_panes="A2"; ws.auto_filter.ref=ws.dimensions
    stream=io.BytesIO(); wb.save(stream); stream.seek(0)
    return StreamingResponse(stream,media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",headers={"Content-Disposition":"attachment; filename=weight_records.xlsx"})


@router.get("/activity", response_class=HTMLResponse)
def activity(request:Request,page:int=1,db:Session=Depends(get_db)):
    page=max(1,page); total=db.scalar(select(func.count()).select_from(ActivityLog)); rows=db.scalars(select(ActivityLog).order_by(desc(ActivityLog.performed_at)).offset((page-1)*settings.page_size).limit(settings.page_size)).all()
    return templates.TemplateResponse(request,"activity.html",ctx(request,rows=rows,page=page,pages=max(1,math.ceil(total/settings.page_size))))

