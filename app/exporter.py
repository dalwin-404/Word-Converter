import io
from typing import List, Dict, Any, Optional
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.style import WD_STYLE_TYPE
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

class CBTExporter:
    """
    Exporters for CBT exam questions into:
    1. Standardized Word Document (.docx) matching HoneyGold CBT Template
    2. Aiken Format (.txt) for direct Moodle/Blackboard/LMS import
    3. Excel Spreadsheet (.xlsx) for CBT platforms with custom columns
    4. JSON data
    """

    @staticmethod
    def generate_docx(
        questions: List[Dict[str, Any]],
        school_name: str = "HONEYGOLD SCHOOL",
        template_title: str = "CBT EXAM QUESTIONS TEMPLATE",
        instructions: str = "Instructions for Teachers: Type each question number (e.g. 1.), followed by options A, B, C, D, and write ANSWER: [Letter] below the options.",
        font_name: str = "Calibri",
        font_size: int = 11,
        option_prefix_style: str = "A)" # A) or A. or (A)
    ) -> bytes:
        """
        Creates a clean, standardized Word document matching the HoneyGold CBT template.
        """
        doc = Document()

        # Set page margins (1 inch all around)
        sections = doc.sections
        for section in sections:
            section.top_margin = Inches(0.8)
            section.bottom_margin = Inches(0.8)
            section.left_margin = Inches(0.9)
            section.right_margin = Inches(0.9)

        # Helper to format run font
        def style_run(run, bold=False, italic=False, size=font_size, color=None):
            run.font.name = font_name
            run.font.size = Pt(size)
            run.bold = bold
            run.italic = italic
            if color:
                run.font.color.rgb = color

        # 1. Document Title / School Header
        title_para = doc.add_paragraph()
        title_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        title_para.paragraph_format.space_after = Pt(4)
        title_para.paragraph_format.space_before = Pt(0)
        
        full_title = f"{school_name.upper()} - {template_title.upper()}"
        r_title = title_para.add_run(full_title)
        style_run(r_title, bold=True, size=font_size + 3, color=RGBColor(26, 54, 93))

        # 2. Instructions line
        if instructions:
            inst_para = doc.add_paragraph()
            inst_para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            inst_para.paragraph_format.space_after = Pt(14)
            inst_para.paragraph_format.space_before = Pt(2)
            r_inst = inst_para.add_run(instructions)
            style_run(r_inst, italic=True, size=font_size - 1, color=RGBColor(74, 85, 104))

        # 3. Add Questions
        for idx, q in enumerate(questions, start=1):
            q_num = idx
            stem = q.get("stem", "").strip()

            # Question Paragraph: e.g. "1. What is the capital city of Nigeria?"
            q_para = doc.add_paragraph()
            q_para.paragraph_format.space_before = Pt(8)
            q_para.paragraph_format.space_after = Pt(2)
            q_para.paragraph_format.line_spacing = 1.15
            
            r_num = q_para.add_run(f"{q_num}. ")
            style_run(r_num, bold=True, size=font_size)

            r_stem = q_para.add_run(stem)
            style_run(r_stem, bold=False, size=font_size)

            # Options A, B, C, D
            options = q.get("options", {})
            sorted_keys = sorted(options.keys())
            
            # If options are empty or incomplete, default to A, B, C, D
            display_keys = sorted_keys if sorted_keys else ["A", "B", "C", "D"]

            for opt_key in display_keys:
                opt_val = options.get(opt_key, "").strip()
                opt_para = doc.add_paragraph()
                opt_para.paragraph_format.left_indent = Inches(0.2)
                opt_para.paragraph_format.space_before = Pt(0)
                opt_para.paragraph_format.space_after = Pt(1)
                opt_para.paragraph_format.line_spacing = 1.15

                # Format prefix based on option_prefix_style
                if option_prefix_style == "A.":
                    prefix_str = f"{opt_key}. "
                elif option_prefix_style == "(A)":
                    prefix_str = f"({opt_key}) "
                else:
                    prefix_str = f"{opt_key}) " # Default HoneyGold A)

                r_opt_key = opt_para.add_run(prefix_str)
                style_run(r_opt_key, bold=True, size=font_size)

                r_opt_val = opt_para.add_run(opt_val)
                style_run(r_opt_val, bold=False, size=font_size)

            # ANSWER line: e.g. "ANSWER: B"
            ans_letter = q.get("answer", "").strip().upper()
            ans_para = doc.add_paragraph()
            ans_para.paragraph_format.left_indent = Inches(0.2)
            ans_para.paragraph_format.space_before = Pt(1)
            ans_para.paragraph_format.space_after = Pt(10) # clean gap before next question

            r_ans_label = ans_para.add_run("ANSWER: ")
            style_run(r_ans_label, bold=True, size=font_size, color=RGBColor(43, 108, 176))

            r_ans_val = ans_para.add_run(ans_letter if ans_letter else "[UNSET]")
            if not ans_letter:
                style_run(r_ans_val, bold=True, size=font_size, color=RGBColor(229, 62, 62))
            else:
                style_run(r_ans_val, bold=True, size=font_size, color=RGBColor(43, 108, 176))

        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_aiken_txt(
        questions: List[Dict[str, Any]],
        include_header_comment: bool = True,
        school_name: str = "HONEYGOLD SCHOOL"
    ) -> str:
        """
        Creates standard Aiken format text.
        Aiken format:
        Question text
        A) Option A
        B) Option B
        C) Option C
        D) Option D
        ANSWER: B
        """
        lines = []
        if include_header_comment:
            lines.append(f"// {school_name.upper()} - AIKEN CBT EXAM QUESTIONS")
            lines.append("")

        for idx, q in enumerate(questions, start=1):
            stem = q.get("stem", "").strip()
            # Standard Aiken usually omits the question number or keeps it
            lines.append(f"{idx}. {stem}")

            options = q.get("options", {})
            for key in sorted(options.keys()):
                val = options[key].strip()
                lines.append(f"{key}) {val}")

            ans = q.get("answer", "").strip().upper()
            lines.append(f"ANSWER: {ans if ans else 'A'}")
            lines.append("")

        return "\n".join(lines)

    @staticmethod
    def generate_excel(
        questions: List[Dict[str, Any]],
        school_name: str = "HONEYGOLD SCHOOL"
    ) -> bytes:
        """
        Generates an Excel spreadsheet (.xlsx) with styled columns for CBT upload.
        """
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "CBT Questions"

        # Headers
        headers = [
            "S/N", "Question", "Option A", "Option B", "Option C", "Option D", "Option E", "Correct Answer", "Validation Status"
        ]
        ws.append(headers)

        # Style header row
        header_fill = PatternFill(start_color="1A365D", end_color="1A365D", fill_type="solid")
        header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        center_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

        for col_idx in range(1, len(headers) + 1):
            cell = ws.cell(row=1, column=col_idx)
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_align

        # Data rows
        data_font = Font(name="Calibri", size=11)
        warning_font = Font(name="Calibri", size=10, italic=True, color="C53030")
        success_font = Font(name="Calibri", size=10, color="2F855A")

        for idx, q in enumerate(questions, start=1):
            options = q.get("options", {})
            opt_a = options.get("A", "")
            opt_b = options.get("B", "")
            opt_c = options.get("C", "")
            opt_d = options.get("D", "")
            opt_e = options.get("E", "")
            ans = q.get("answer", "")
            
            warnings = q.get("warnings", [])
            status_text = "OK" if not warnings else "; ".join(warnings)

            row = [
                idx,
                q.get("stem", ""),
                opt_a,
                opt_b,
                opt_c,
                opt_d,
                opt_e,
                ans,
                status_text
            ]
            ws.append(row)

            # Style status cell
            status_cell = ws.cell(row=idx + 1, column=len(headers))
            if warnings:
                status_cell.font = warning_font
            else:
                status_cell.font = success_font

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = 0
            col_letter = get_column_letter(col[0].column)
            for cell in col:
                val = str(cell.value or "")
                if len(val) > max_len:
                    max_len = len(val)
            # Bound column width between 10 and 55
            ws.column_dimensions[col_letter].width = max(10, min(max_len + 3, 55))

        buffer = io.BytesIO()
        wb.save(buffer)
        buffer.seek(0)
        return buffer.getvalue()
