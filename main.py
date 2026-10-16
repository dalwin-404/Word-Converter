import io
import json
import webbrowser
import threading
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, UploadFile, File, Form, Request, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.parser import QuestionParser
from app.exporter import CBTExporter
from app.batch_engine import BatchEngine

app = FastAPI(
    title="CBT Exam Word Converter",
    description="Intelligent CBT Exam Word Processor & Converter for HoneyGold CBT Template",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

parser = QuestionParser()
exporter = CBTExporter()
batch_engine = BatchEngine()

# Pydantic Request Models
class TextParseRequest(BaseModel):
    text: str

class ExportRequest(BaseModel):
    questions: List[Dict[str, Any]]
    school_name: str = "HONEYGOLD SCHOOL"
    template_title: str = "CBT EXAM QUESTIONS TEMPLATE"
    instructions: str = "Instructions for Teachers: Type each question number (e.g. 1.), followed by options A, B, C, D, and write ANSWER: [Letter] below the options."
    font_name: str = "Calibri"
    font_size: int = 11
    option_prefix_style: str = "A)"

@app.get("/", response_class=HTMLResponse)
async def serve_index():
    with open("app/templates/index.html", "r", encoding="utf-8") as f:
        return f.read()

@app.post("/api/parse-text")
async def parse_text_endpoint(req: TextParseRequest):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty text provided.")
    result = parser.parse_text(req.text)
    return result

@app.post("/api/parse-docx")
async def parse_docx_endpoint(file: UploadFile = File(...)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    result = parser.parse_docx(content)
    return result

@app.post("/api/batch-convert")
async def batch_convert_endpoint(
    files: List[UploadFile] = File(...),
    school_name: str = Form("HONEYGOLD SCHOOL"),
    template_title: str = Form("CBT EXAM QUESTIONS TEMPLATE"),
    instructions: str = Form("Instructions for Teachers: Type each question number (e.g. 1.), followed by options A, B, C, D, and write ANSWER: [Letter] below the options."),
    font_name: str = Form("Calibri"),
    font_size: int = Form(11),
    option_prefix_style: str = Form("A)")
):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    files_data = []
    for f in files:
        data = await f.read()
        files_data.append((f.filename, data))

    summary, zip_bytes = batch_engine.process_multiple_files(
        files_data=files_data,
        school_name=school_name,
        template_title=template_title,
        instructions=instructions,
        font_name=font_name,
        font_size=font_size,
        option_prefix_style=option_prefix_style
    )

    # Return zip archive with summary serialized in a custom header
    summary_header = json.dumps([{
        "filename": s["filename"],
        "total_questions": s["total_questions"],
        "warning_count": s["warning_count"],
        "questions": s["questions"]
    } for s in summary])

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={
            "Content-Disposition": 'attachment; filename="Batch_CBT_Exams.zip"',
            "X-Summary-Data": summary_header,
            "Access-Control-Expose-Headers": "X-Summary-Data"
        }
    )

@app.post("/api/export/docx")
async def export_docx_endpoint(req: ExportRequest):
    docx_bytes = exporter.generate_docx(
        questions=req.questions,
        school_name=req.school_name,
        template_title=req.template_title,
        instructions=req.instructions,
        font_name=req.font_name,
        font_size=req.font_size,
        option_prefix_style=req.option_prefix_style
    )
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": 'attachment; filename="CBT_Exam_HoneyGold.docx"'
        }
    )

@app.post("/api/export/aiken")
async def export_aiken_endpoint(req: ExportRequest):
    aiken_txt = exporter.generate_aiken_txt(
        questions=req.questions,
        school_name=req.school_name
    )
    return StreamingResponse(
        io.BytesIO(aiken_txt.encode("utf-8")),
        media_type="text/plain; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="CBT_Exam_Aiken.txt"'
        }
    )

@app.post("/api/export/excel")
async def export_excel_endpoint(req: ExportRequest):
    excel_bytes = exporter.generate_excel(
        questions=req.questions,
        school_name=req.school_name
    )
    return StreamingResponse(
        io.BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="CBT_Exam_Matrix.xlsx"'
        }
    )

def open_browser():
    webbrowser.open_new("http://localhost:8000")

if __name__ == "__main__":
    import uvicorn
    # Automatically open the browser after half a second
    threading.Timer(0.8, open_browser).start()
    print("\n" + "="*65)
    print("  🚀 CBT Word Converter is running at http://localhost:8000")
    print("  📄 Tailored for HoneyGold CBT Exam Template")
    print("="*65 + "\n")
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
