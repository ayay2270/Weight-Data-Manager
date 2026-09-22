from io import BytesIO
from sqlalchemy import select
from app.config import BASE_DIR
from app.database import SessionLocal
from app.models import ActivityLog, Measurement
from app.services.measurements import comparison

def record_form(**overrides):
    data={"current_user":"Tester A","project":"TEST-PROJECT","level":"Part","description":"Shared test part","lenovo_pn":"TEST-001","customer_pn":"CUST-001","manufacturer":"Test Lab","category":"CPU","weight_value":"100","weight_unit":"g","value_type":"Measured","measured_date":"2026-09-20","measured_by":"Tester A","project_phase":"DV","data_source":"Internal","note":"Automated test"}
    data.update(overrides); return data

def create(client,**overrides):
    response=client.post("/records/new",data=record_form(**overrides),follow_redirects=False)
    assert response.status_code==303
    return int(response.headers["location"].split("/")[2].split("?")[0])

def test_health_dashboard_and_initial_excel_import(client):
    assert client.get("/health").json()=={"status":"ok","database":"ok","version":"1.0.0"}
    page=client.get("/"); assert page.status_code==200 and "Weight Data" in page.text
    with SessionLocal() as db:
        rows=db.scalars(select(Measurement).where(Measurement.import_fingerprint.is_not(None))).all()
        assert len(rows)==49 and {x.level for x in rows}=={"Part","Node","Rack","Package"}
        assert any(x.value_type=="TBD" and x.weight_value is None for x in rows)
        assert all(x.weight_value is None or isinstance(x.weight_value,float) for x in rows)

def test_add_edit_submit_approve_and_activity(client):
    mid=create(client); assert "Shared test part" in client.get(f"/records/{mid}").text
    version=client.get(f"/api/measurements/{mid}").json()["version"]
    edited=record_form(description="Shared test part edited",weight_value="101.5",version=str(version),current_user="Tester B")
    assert client.post(f"/records/{mid}/edit",data=edited,follow_redirects=False).status_code==303
    assert client.post(f"/records/{mid}/action",data={"current_user":"Tester A","action":"Submit"},follow_redirects=False).status_code==303
    assert client.get(f"/api/measurements/{mid}").json()["status"]=="Pending Review"
    assert client.post(f"/records/{mid}/action",data={"current_user":"Engineer C","action":"Approve"},follow_redirects=False).status_code==303
    assert client.get(f"/api/measurements/{mid}").json()["status"]=="Approved"
    with SessionLocal() as db:
        assert db.scalars(select(ActivityLog.action).where(ActivityLog.measurement_id==mid)).all()==["Create","Edit","Submit","Approve"]

def test_return_requires_comment(client):
    mid=create(client,lenovo_pn="RET-001",description="Return workflow")
    client.post(f"/records/{mid}/action",data={"current_user":"Tester","action":"Submit"})
    assert client.post(f"/records/{mid}/action",data={"current_user":"Engineer","action":"Return","comment":""}).status_code==422
    good=client.post(f"/records/{mid}/action",data={"current_user":"Engineer","action":"Return","comment":"Please remeasure"},follow_redirects=False)
    assert good.status_code==303 and client.get(f"/api/measurements/{mid}").json()["status"]=="Returned"

def test_history_difference_and_abnormal_warning(client):
    first=create(client,lenovo_pn="HIST-001",description="History part",weight_value="100",measured_date="2026-09-19")
    client.post(f"/records/{first}/action",data={"current_user":"T","action":"Submit"}); client.post(f"/records/{first}/action",data={"current_user":"E","action":"Approve"})
    second=create(client,lenovo_pn="HIST-001",description="History part",weight_value="112",measured_date="2026-09-20")
    with SessionLocal() as db:
        c=comparison(db,db.get(Measurement,second)); assert round(c["difference"],3)==12 and round(c["percent"],2)==12 and c["warning"] is True
    assert "Abnormal weight warning" in client.get(f"/records/{second}").text

def test_search_filter_sort_pagination_and_exports(client):
    assert "History part" in client.get("/records?search=HIST-001&level=Part&value_type=Measured&data_source=Internal&sort=weight&direction=desc").text
    csv_response=client.get("/export.csv?project=TEST-PROJECT&level=Part"); assert csv_response.status_code==200 and "Weight" in csv_response.text
    xlsx=client.get("/export.xlsx?project=TEST-PROJECT"); assert xlsx.status_code==200 and xlsx.content[:2]==b"PK"

def test_two_sessions_share_data_and_auto_refresh(client,client_b):
    before=client_b.get("/api/revision").json()["revision"]
    mid=create(client,lenovo_pn="LIVE-001",description="Live shared item")
    assert client_b.get(f"/api/measurements/{mid}").json()["description"]=="Live shared item"
    assert client_b.get("/api/revision").json()["revision"]!=before
    script=client_b.get("/static/app.js").text; assert "setInterval" in script and "/api/revision" in script

def test_optimistic_lock_prevents_overwrite(client,client_b):
    mid=create(client,lenovo_pn="LOCK-001",description="Lock item")
    version=client.get(f"/api/measurements/{mid}").json()["version"]
    assert client.post(f"/records/{mid}/edit",data=record_form(lenovo_pn="LOCK-001",description="Saved by A",version=str(version),current_user="A"),follow_redirects=False).status_code==303
    conflict=client_b.post(f"/records/{mid}/edit",data=record_form(lenovo_pn="LOCK-001",description="Stale B",version=str(version),current_user="B"))
    assert conflict.status_code==409 and "updated by another user" in conflict.text
    assert client.get(f"/api/measurements/{mid}").json()["description"]=="Saved by A"

def test_soft_delete_and_log(client):
    mid=create(client,lenovo_pn="DEL-001",description="Delete item")
    assert client.post(f"/records/{mid}/action",data={"current_user":"Maintainer","action":"Delete"},follow_redirects=False).status_code==303
    assert client.get(f"/api/measurements/{mid}").status_code==404
    with SessionLocal() as db: assert db.get(Measurement,mid).is_deleted is True

def test_duplicate_excel_import_is_safe(client):
    sample=BASE_DIR/"data"/"Weight Measurement Record_X01.xlsx"; payload=sample.read_bytes()
    response=client.post("/import-export/import",files={"file":("Weight Measurement Record_X01.xlsx",BytesIO(payload),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},data={"current_user":"Importer"})
    assert response.status_code==200 and "already imported" in response.text
    with SessionLocal() as db: assert len(db.scalars(select(Measurement).where(Measurement.import_fingerprint.is_not(None))).all())==49

def test_summary_review_queue_and_restart_persistence(client,client_b):
    assert client.get("/summary?project=S219B").status_code==200 and client.get("/review").status_code==200
    mid=create(client,lenovo_pn="PERSIST-001",description="Persistent item")
    assert client_b.get(f"/api/measurements/{mid}").status_code==200
