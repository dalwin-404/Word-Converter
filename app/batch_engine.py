import io
import zipfile
import os
from typing import List, Dict, Any, Tuple
from app.parser import QuestionParser
from app.exporter import CBTExporter

class BatchEngine:
    """
    Handles processing of multiple exam documents simultaneously and
    packages results into a structured ZIP file.
    """

    def __init__(self):
        self.parser = QuestionParser()
        self.exporter = CBTExporter()

    def process_multiple_files(
        self,
        files_data: List[Tuple[str, bytes]], # list of (filename, file_bytes)
        school_name: str = "HONEYGOLD SCHOOL",
        template_title: str = "CBT EXAM QUESTIONS TEMPLATE",
        instructions: str = "Instructions for Teachers: Type each question number (e.g. 1.), followed by options A, B, C, D, and write ANSWER: [Letter] below the options.",
        font_name: str = "Calibri",
        font_size: int = 11,
        option_prefix_style: str = "A)"
    ) -> Tuple[List[Dict[str, Any]], bytes]:
        """
        Processes a list of uploaded files, returning structured summary JSON
        and a complete ZIP archive.
        """
        results_summary = []
        zip_buffer = io.BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            report_lines = [
                "=" * 70,
                f"  {school_name.upper()} - BATCH CBT CONVERSION REPORT",
                "=" * 70,
                f"Total Files Processed: {len(files_data)}",
                ""
            ]

            for original_filename, file_bytes in files_data:
                base_name, ext = os.path.splitext(original_filename)
                clean_base_name = base_name.replace(" ", "_")

                try:
                    if ext.lower() == ".docx":
                        parsed = self.parser.parse_docx(file_bytes)
                    else:
                        # Assume text-based or decode as utf-8
                        text_content = file_bytes.decode("utf-8", errors="ignore")
                        parsed = self.parser.parse_text(text_content)

                    questions = parsed["questions"]
                    total_q = len(questions)
                    warning_count = sum(len(q.get("warnings", [])) for q in questions)

                    file_summary = {
                        "filename": original_filename,
                        "clean_name": clean_base_name,
                        "success": True,
                        "total_questions": total_q,
                        "warning_count": warning_count,
                        "questions": questions,
                        "error_message": None
                    }
                    results_summary.append(file_summary)

                    # Generate individual files for the zip
                    docx_bytes = self.exporter.generate_docx(
                        questions=questions,
                        school_name=school_name,
                        template_title=template_title,
                        instructions=instructions,
                        font_name=font_name,
                        font_size=font_size,
                        option_prefix_style=option_prefix_style
                    )
                    aiken_txt = self.exporter.generate_aiken_txt(
                        questions=questions,
                        school_name=school_name
                    )
                    excel_bytes = self.exporter.generate_excel(
                        questions=questions,
                        school_name=school_name
                    )

                    # Add into zip folders
                    zip_file.writestr(f"01_Word_Standardized/{clean_base_name}_CBT_Template.docx", docx_bytes)
                    zip_file.writestr(f"02_Aiken_CBT_Txt/{clean_base_name}_Aiken.txt", aiken_txt.encode("utf-8"))
                    zip_file.writestr(f"03_Excel_Spreadsheets/{clean_base_name}_Matrix.xlsx", excel_bytes)

                    report_lines.append(f"✓ [{clean_base_name}]")
                    report_lines.append(f"   • Questions converted: {total_q}")
                    report_lines.append(f"   • Validation alerts: {warning_count}")
                    if warning_count > 0:
                        for q in questions:
                            if q.get("warnings"):
                                report_lines.append(f"      - Question #{q['number']}: {'; '.join(q['warnings'])}")
                    report_lines.append("")

                except Exception as e:
                    file_summary = {
                        "filename": original_filename,
                        "clean_name": clean_base_name,
                        "success": False,
                        "total_questions": 0,
                        "warning_count": 0,
                        "questions": [],
                        "error_message": str(e)
                    }
                    results_summary.append(file_summary)
                    report_lines.append(f"✗ [{original_filename}] Failed to process: {str(e)}")
                    report_lines.append("")

            # Write master summary report to the zip
            zip_file.writestr("00_BATCH_SUMMARY_REPORT.txt", "\n".join(report_lines).encode("utf-8"))

        zip_buffer.seek(0)
        return results_summary, zip_buffer.getvalue()
