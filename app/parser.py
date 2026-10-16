import re
import io
from typing import List, Dict, Any, Optional, Tuple
from docx import Document

class QuestionParser:
    """
    Robust, multi-heuristic parser for CBT exam questions from .docx documents
    or raw text strings.
    """

    # Regex patterns for question starters: 1., 1), Q1., Question 1:, [1], 1 -
    QUESTION_START_REGEX = re.compile(
        r'^(?:(?:Question|Q|Ques)\s*[-.:]?\s*(\d+)|\((\d+)\)|\[(\d+)\]|(\d+)\s*[-.:)])\s*(.*)$',
        re.IGNORECASE
    )

    # Regex for options (A-E): A), A., (A), [A], a., a), *A), A*)
    OPTION_START_REGEX = re.compile(
        r'^(?:\*|[\u2713\u2714\u2022\-])?\s*(?:\(([A-Ea-e])\)|\[([A-Ea-e])\]|([A-Ea-e])\s*[*]?\s*[-.:)])\s*(.*)$'
    )

    # Regex for inline options: A) ... B) ... C) ... D) ...
    INLINE_OPTIONS_REGEX = re.compile(
        r'(?:^|\s+)(?:\*|[\u2713\u2714\u2022\-])?\s*(?:\(([A-Ea-e])\)|\[([A-Ea-e])\]|([A-Ea-e])\s*[*]?\s*[-.:)])\s*'
    )

    # Regex for answer indicators: ANSWER: B, Ans: B, Correct: B, Key: B
    ANSWER_REGEX = re.compile(
        r'^(?:ANSWER|ANS|CORRECT\s*ANSWER|CORRECT|KEY|ANSW)\s*[:=\-]?\s*([A-Ea-e])\b',
        re.IGNORECASE
    )

    # Regex for bottom answer keys: "ANSWERS: 1. A, 2. B, 3. C" or "1: A 2: B"
    BOTTOM_KEY_ITEM_REGEX = re.compile(
        r'(?:Q?(\d+)\s*[:.-]?\s*([A-Ea-e]))',
        re.IGNORECASE
    )

    def parse_docx(self, docx_bytes: bytes) -> Dict[str, Any]:
        """Parse a .docx file provided as raw bytes."""
        doc = Document(io.BytesIO(docx_bytes))
        paragraphs_data = []

        # Extract text & styling metadata from paragraphs
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue

            # Check if any run is bold or highlighted (could indicate the correct option)
            bold_text = []
            highlighted_text = []
            for r in p.runs:
                r_text = r.text.strip()
                if not r_text:
                    continue
                if r.bold:
                    bold_text.append(r_text)
                if r.font.highlight_color:
                    highlighted_text.append(r_text)

            paragraphs_data.append({
                "text": text,
                "bold_runs": bold_text,
                "is_entirely_bold": bool(p.runs and all(r.bold for r in p.runs if r.text.strip())),
                "highlighted_runs": highlighted_text
            })

        # Also inspect tables if the questions were put in a Word table
        for table in doc.tables:
            for row in table.rows:
                row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                for cell_text in row_texts:
                    paragraphs_data.append({
                        "text": cell_text,
                        "bold_runs": [],
                        "is_entirely_bold": False,
                        "highlighted_runs": []
                    })

        return self._process_paragraphs(paragraphs_data)

    def parse_text(self, raw_text: str) -> Dict[str, Any]:
        """Parse raw plain text string."""
        paragraphs_data = [
            {
                "text": line.strip(),
                "bold_runs": [],
                "is_entirely_bold": False,
                "highlighted_runs": []
            }
            for line in raw_text.splitlines()
            if line.strip()
        ]
        return self._process_paragraphs(paragraphs_data)

    def _process_paragraphs(self, paragraphs: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        State-machine parser that reconstructs questions, options, and answers.
        """
        questions: List[Dict[str, Any]] = []
        bottom_answer_keys: Dict[int, str] = {}

        current_q: Optional[Dict[str, Any]] = None
        current_option_letter: Optional[str] = None
        extracted_title = ""

        # First pass: check for a trailing answer key section
        paragraphs, bottom_answer_keys = self._extract_bottom_answer_keys(paragraphs)

        for p_idx, p in enumerate(paragraphs):
            text = p["text"]

            # 1. Check for Document Header / Title if at the beginning
            if not questions and current_q is None and p_idx < 3:
                # If it looks like a school name, instructions or header, store it
                if not self.QUESTION_START_REGEX.match(text) and not self.OPTION_START_REGEX.match(text):
                    if not extracted_title:
                        extracted_title = text
                    continue

            # 2. Check for explicit ANSWER tag
            ans_match = self.ANSWER_REGEX.match(text)
            if ans_match:
                answer_letter = ans_match.group(1).upper()
                if current_q:
                    current_q["answer"] = answer_letter
                continue

            # 3. Check for new Question start (e.g., "1. What is...", "Q1: ...")
            q_match = self.QUESTION_START_REGEX.match(text)
            # Make sure it's not actually an option like "A. ..." or answer
            if q_match and not self.OPTION_START_REGEX.match(text):
                # Save previous question if exists
                if current_q:
                    self._finalize_question(current_q, bottom_answer_keys)
                    questions.append(current_q)

                q_num_str = (q_match.group(1) or q_match.group(2) or q_match.group(3) or q_match.group(4) or "").strip()
                q_num = int(q_num_str) if q_num_str.isdigit() else len(questions) + 1
                stem = q_match.group(5).strip()

                current_q = {
                    "number": q_num,
                    "stem": stem,
                    "options": {},
                    "answer": None,
                    "warnings": [],
                    "raw_lines": [text]
                }
                current_option_letter = None
                continue

            # 4. Check for Option line (e.g. "A) Lagos", "B. Abuja")
            opt_match = self.OPTION_START_REGEX.match(text)
            if opt_match and current_q is not None:
                letter = (opt_match.group(1) or opt_match.group(2) or opt_match.group(3)).upper()
                remainder = opt_match.group(4).strip()

                # Check if this line has multiple inline options: A) Cat B) Dog C) Fish D) Bird
                inline_opts = self._split_inline_options(text)
                if len(inline_opts) > 1:
                    for inline_letter, inline_val in inline_opts:
                        current_q["options"][inline_letter] = inline_val
                        # Check if this option was marked with an asterisk (*A)
                        if inline_val.startswith("*") or inline_letter.startswith("*"):
                            current_q["answer"] = inline_letter.replace("*", "")
                            current_q["options"][inline_letter] = inline_val.lstrip("* ")
                    current_option_letter = inline_opts[-1][0]
                else:
                    # Single option line
                    is_starred = remainder.startswith("*") or text.startswith("*")
                    opt_value = remainder.lstrip("* ").strip()
                    current_q["options"][letter] = opt_value
                    current_option_letter = letter

                    if is_starred:
                        current_q["answer"] = letter

                    # Check if run styling indicated answer (bold / highlight)
                    if not current_q["answer"]:
                        if p.get("is_entirely_bold") or (p.get("bold_runs") and any(opt_value in b for b in p.get("bold_runs", []))):
                            current_q["_bold_candidate"] = letter
                        if p.get("highlighted_runs"):
                            current_q["answer"] = letter

                current_q["raw_lines"].append(text)
                continue

            # 5. Check if it's an inline option line without a leading option regex match
            # e.g., line starts with whitespace and then A)
            inline_opts = self._split_inline_options(text)
            if len(inline_opts) >= 2 and current_q is not None:
                for inline_letter, inline_val in inline_opts:
                    current_q["options"][inline_letter] = inline_val
                current_option_letter = inline_opts[-1][0]
                current_q["raw_lines"].append(text)
                continue

            # 6. Unmatched line: could be multi-line question stem or multi-line option
            if current_q is not None:
                if current_option_letter and current_option_letter in current_q["options"]:
                    # Continuation of previous option
                    current_q["options"][current_option_letter] += " " + text
                else:
                    # Continuation of question stem
                    if current_q["stem"]:
                        current_q["stem"] += " " + text
                    else:
                        current_q["stem"] = text
                current_q["raw_lines"].append(text)

        # Save last question
        if current_q:
            self._finalize_question(current_q, bottom_answer_keys)
            questions.append(current_q)

        # Post-processing: Global integrity validation
        self._validate_global_continuity(questions)

        return {
            "title": extracted_title or "HONEYGOLD SCHOOL - CBT EXAM QUESTIONS",
            "total_questions": len(questions),
            "questions": questions,
            "has_warnings": any(len(q.get("warnings", [])) > 0 for q in questions)
        }

    def _split_inline_options(self, line: str) -> List[Tuple[str, str]]:
        """
        Detects if multiple options are laid out in a single line:
        e.g. "A) Paris  B) London  C) Rome  D) Berlin"
        """
        matches = list(self.INLINE_OPTIONS_REGEX.finditer(line))
        if len(matches) <= 1:
            # Check single option
            single = self.OPTION_START_REGEX.match(line)
            if single:
                letter = (single.group(1) or single.group(2) or single.group(3)).upper()
                return [(letter, single.group(4).strip())]
            return []

        results = []
        for i in range(len(matches)):
            current_match = matches[i]
            letter = (current_match.group(1) or current_match.group(2) or current_match.group(3)).upper()
            start_pos = current_match.end()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(line)
            option_val = line[start_pos:end_pos].strip()
            # Clean trailing separators like ; or ,
            option_val = re.sub(r'[;,]$', '', option_val).strip()
            results.append((letter, option_val))

        return results

    def _extract_bottom_answer_keys(self, paragraphs: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[int, str]]:
        """
        Extracts answer keys if provided at the bottom of the document
        e.g. "ANSWER KEY: 1. A, 2. B, 3. C..." or "ANSWERS: 1. A, 2. B"
        """
        answer_keys = {}
        kept_paragraphs = []
        is_in_answer_key_section = False

        # Only match actual section headers like "ANSWER KEY", "MARKING SCHEME",
        # or "ANSWERS:" that are followed by number mapping (e.g. "1. A, 2. B")
        section_header_regex = re.compile(
            r'^(?:ANSWER\s+KEYS?|MARKING\s+SCHEME|ANSWERS\s+SHEET)\b',
            re.IGNORECASE
        )

        for p in paragraphs:
            text = p["text"]

            # If it's a single question answer like "ANSWER: B" or "Ans: B", keep it in paragraphs
            if self.ANSWER_REGEX.match(text):
                kept_paragraphs.append(p)
                continue

            if section_header_regex.match(text):
                is_in_answer_key_section = True
                items = self.BOTTOM_KEY_ITEM_REGEX.findall(text)
                for q_num, ans in items:
                    answer_keys[int(q_num)] = ans.upper()
                continue

            if is_in_answer_key_section:
                items = self.BOTTOM_KEY_ITEM_REGEX.findall(text)
                if items:
                    for q_num, ans in items:
                        answer_keys[int(q_num)] = ans.upper()
                    continue

            kept_paragraphs.append(p)

        return kept_paragraphs, answer_keys

    def _finalize_question(self, q: Dict[str, Any], bottom_keys: Dict[int, str]):
        """Runs checks and resolves answer for an individual question."""
        q_num = q["number"]

        # Check bottom answer key fallback
        if not q.get("answer") and q_num in bottom_keys:
            q["answer"] = bottom_keys[q_num]

        # Check bold run candidate
        if not q.get("answer") and "_bold_candidate" in q:
            q["answer"] = q["_bold_candidate"]

        # Clean internal fields
        q.pop("_bold_candidate", None)

        # Warnings check
        warnings = []
        if not q.get("answer"):
            warnings.append("Missing correct answer (no ANSWER tag or marked option found)")
        elif q["answer"] not in q.get("options", {}):
            warnings.append(f"Answer '{q['answer']}' is not among detected options ({', '.join(q.get('options', {}).keys())})")

        opt_count = len(q.get("options", {}))
        if opt_count < 4:
            missing_std = [ltr for ltr in ["A", "B", "C", "D"] if ltr not in q.get("options", {})]
            warnings.append(f"Incomplete options (found {opt_count}, expected 4). Missing: {', '.join(missing_std)}")

        # Check for empty options
        for ltr, text in q.get("options", {}).items():
            if not text.strip():
                warnings.append(f"Option {ltr} is blank")

        q["warnings"] = warnings

    def _validate_global_continuity(self, questions: List[Dict[str, Any]]):
        """Validates sequential numbering across questions."""
        for i in range(len(questions)):
            expected = i + 1
            actual = questions[i]["number"]
            if actual != expected:
                questions[i]["warnings"].append(f"Numbering mismatch: Expected #{expected}, found #{actual}")
