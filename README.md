# CBTFlow — Universal CBT & Exam Word Converter

An intelligent, 100% free, multi-school document processor tailored for schools, colleges, and examination officers to convert messy teacher exam questions in Microsoft Word (`.docx`) into standardized Computer-Based Testing (CBT) formats.

---

## ✨ Features

- **Universal Multi-School Customizer**:
  - Customize School Name, Exam Title, Instructions, Typography, and Option Styles (`A)`, `A.`, `(A)`)
  - One-click presets for Secondary & High Schools, Colleges & Universities, WAEC / JAMB, and Moodle LMS
- **Smart "Messy Draft" Ingestion**:
  - Supports multiple option styles (`A.`, `A)`, `(A)`, `[A]`)
  - Auto-detects inline options on a single line (`A) Cat  B) Dog  C) Fish  D) Bird`)
  - Detects answers from `ANSWER: B`, `Ans: B`, **bold** options, colored text, or `*` asterisks
  - Detects bottom answer-key sheets (`ANSWERS: 1. A, 2. B...`)
- **Unlimited Batch Processing**:
  - Drag and drop 1 or 50 Word files at once
  - One-click master **ZIP Download** with organized folders:
    - `01_Word_Standardized/` (`.docx` formatted to your school standard)
    - `02_Aiken_CBT_Txt/` (`.txt` for Moodle / Canvas / Blackboard)
    - `03_Excel_Spreadsheets/` (`.xlsx` CBT matrix)
    - `00_BATCH_SUMMARY_REPORT.txt`
- **Zero Cost & Complete Privacy**:
  - No cloud AI API fees or subscriptions
  - 100% in-browser processing: exam questions never leave your device
  - Deployable online to Vercel or Netlify for free

---

## 🚀 How to Run Locally

### Next.js Modern Web App (Recommended):
```powershell
cd frontend
npm run dev
```
Open **`http://localhost:3000`** in your browser.

Or simply double-click [`run.bat`](file:///c:/Users/HP/Desktop/SANBOXES/Word-Converter/run.bat).

---

## 🌐 How to Host Online for Free

See [`DEPLOYMENT_GUIDE.md`](file:///c:/Users/HP/Desktop/SANBOXES/Word-Converter/DEPLOYMENT_GUIDE.md) for 1-click free deployment to Vercel or Netlify.
