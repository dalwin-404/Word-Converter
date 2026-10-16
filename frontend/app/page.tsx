'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Sparkles,
  Zap,
  Archive,
  Table,
  Terminal,
  X,
  FileCheck,
  ChevronDown,
  Building2,
  School,
  Edit2,
  FileDown,
  HelpCircle,
  CheckCircle,
  Copy,
  Info,
  Image as ImageIcon
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Question, SchoolPreset, BatchFileResult } from '../lib/types';
import { parseText, parseDocxFile } from '../lib/parser';
import {
  generateDocxBlob,
  generateGuideTemplateDocxBlob,
  generateAikenText,
  generateExcelBlob,
  generateBatchZipBlob,
  ExportOptions,
} from '../lib/exporter';

// Available School & Exam Presets
const PRESETS: SchoolPreset[] = [
  {
    id: 'standard',
    name: '🏫 Standard Secondary & High School',
    schoolName: 'EXCELLENCE ACADEMY',
    templateTitle: 'CBT EXAM QUESTIONS TEMPLATE',
    instructions: 'Instructions for Teachers: Type each question number (e.g. 1.), followed by options A, B, C, D, and write ANSWER: [Letter] below the options.',
    optionPrefix: 'A)',
    fontName: 'Calibri',
  },
  {
    id: 'college',
    name: '🏛️ College / University CAT',
    schoolName: 'FACULTY OF BASIC & APPLIED SCIENCES',
    templateTitle: 'CONTINUOUS ASSESSMENT TEST (CAT)',
    instructions: 'Instructions for Examiners: Multiple choice questions formatted for automated CBT/LMS ingestion. Indicate correct answer below options.',
    optionPrefix: 'A)',
    fontName: 'Calibri',
  },
  {
    id: 'national',
    name: '🇳🇬 National Exam (WAEC / JAMB Style)',
    schoolName: 'NATIONAL EXAMINATIONS BOARD',
    templateTitle: 'COMPUTER-BASED TEST (CBT) ASSESSMENT',
    instructions: 'Answer all questions. Each question has four options labeled A to D. Indicate the correct answer clearly.',
    optionPrefix: 'A)',
    fontName: 'Arial',
  },
  {
    id: 'lms',
    name: '🎓 Moodle & Online LMS Format',
    schoolName: 'DEPARTMENT OF COMPUTER SCIENCE',
    templateTitle: 'ONLINE QUIZ EXAMINATION',
    instructions: 'Multiple choice examination questions formatted for automated CBT/LMS ingestion.',
    optionPrefix: 'A.',
    fontName: 'Times New Roman',
  },
];

const SAMPLE_MATH_DIAGRAM = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAANwAAAB4CAYAAACZ15x5AAACz0lEQVR4nO3VQW5TQRBF0Yi1sze2wRoYRQgBygARWY7zbfd/XdV9Bmdeg7p6L68/f/0BMl5mHwA7ERwECQ6CBAdBgoMgwUGQ4CBIcBAkOAgSHAQJDoIEB0GCgyDBQZDgIEhwECQ4CBIcBAkOggTHVF++fpt+Q5LgmOYtNsHByf6FJjg42WVsgoMTXAtNcHCCy8C+//gtOBjt2pq9xSY4GOyj0ARX4AjWcWvVBCc4BjoSmuAKHEFvR1dNcILjSfeGJrgCR9DPI6smOMHxgGdCE1yBI+jh2VUTnOA4aFRogitwBHWNXDXBCY4bzghNcAWOoJazVk1wguPC2aEJrsARzJdYNcEJjuCqCU5wW0uvmuAEt61ZoQmuwBHkzFw1wQluKxVCE1yBIzhXlVUTnOCWVy00wRU4gvEqrprgBLekyqEJrsARjFF91QQnuGV0CU1wBY7gcZ1WTXCCa61jaIIrcAT36bpqghNcO91DE1yBI/jcCqsmOMG1sFJogitwBNettmqCE1xZq4YmuAJH8N/KqyY4wZWyQ2iCK3DE7nZZNcEJbrrdQhNcgSN2tOOqCU5wU+wcmuAKHLGL3VdNcIKLEZrgXgV3PqsmuPcEdyKhCe6S4E5g1QT3EcENJjTB3SK4Qaya4I4Q3ABCE9xRgnuCVRPcvQT3IKEJ7hGCu5NVE9wzBHcHoQnuWYI7wKoJbhTBfUJoghtJcAdDE5vgRhDcgdhmP+eKBIdVE5zgZsU2+yFXJ7hNWTXBCW5SbLOfcCeC24hVm09wmxBaDYJbnFWrRXALE1o9gluQVatLcIsRWm2CW4RV60FwCxBaH4JrzKr1I7imhNaT4Jqxar0JrhGh9Se4Bq6tGv3N/ivBiW0rs39LcELbyuwfExwsSnAQJDgIEhwECQ6CBAdBgoMgwUGQ4CBIcBAkOAgSHAQJDoIEB0GCgyDBQZDgIEhwECQ4CPoLq5E6YilcvlAAAAAASUVORK5CYII=";

const SAMPLE_TEXT = `EXCELLENCE ACADEMY - CBT EXAM QUESTIONS TEMPLATE
Instructions for Teachers: Type each question number (e.g. 1.), followed by options A, B, C, D, and write ANSWER: [Letter] below the options.

1. What is the capital city of Nigeria?
A) Lagos
B) Abuja
C) Ibadan
D) Kano
ANSWER: B

2. Which organ in the human body is responsible for pumping blood?
A) Lungs
B) Liver
C) Heart
D) Kidney
ANSWER: C

3. In the right-angled triangle diagram shown below, calculate the value of the hypotenuse (x):
A) 4 cm
B) 5 cm
C) 6 cm
D) 7 cm
ANSWER: B

4. What is the chemical formula for water?
A) CO2
B) NaCl
C) H2O
D) O2
ANSWER: C

5. Which continent is Nigeria located in?
A) Asia
B) Africa
C) Europe
D) South America
ANSWER: B`;

interface SubjectPreset {
  id: string;
  name: string;
  icon: string;
  title: string;
  instructions: string;
  font?: string;
}

const SUBJECT_PRESETS: SubjectPreset[] = [
  {
    id: 'math',
    name: 'Mathematics',
    icon: '📐',
    title: 'MATHEMATICS CBT EXAMINATION',
    instructions: 'Answer all questions. Show clear workings. Use of scientific calculators is allowed.',
    font: 'Calibri',
  },
  {
    id: 'fmath',
    name: 'Further Mathematics',
    icon: '🔬',
    title: 'FURTHER MATHEMATICS CBT EXAMINATION',
    instructions: 'Answer all questions. Show all mathematical derivations, formulas, and calculations clearly.',
    font: 'Calibri',
  },
  {
    id: 'english',
    name: 'English Language',
    icon: '📖',
    title: 'ENGLISH LANGUAGE CBT EXAMINATION',
    instructions: 'Read each passage and question carefully before choosing the most appropriate option.',
    font: 'Calibri',
  },
  {
    id: 'yoruba',
    name: 'Yorùbá',
    icon: '🌍',
    title: 'ÈDÈ YORÙBÁ - ÌDÁNWÒ ILÉ-ÌWÉ (CBT)',
    instructions: 'Dáhùn gbogbo àwọn ìbéèrè wọ̀nyí ní kíkún. Kíyèsí àkọtọ́ àti àmì ohùn dáadáa.',
    font: 'Calibri',
  },
  {
    id: 'biology',
    name: 'Biology',
    icon: '🧬',
    title: 'BIOLOGY CBT EXAMINATION',
    instructions: 'Answer all questions. Pay attention to biological diagrams, structures, and specimens.',
    font: 'Arial',
  },
  {
    id: 'chemistry',
    name: 'Chemistry',
    icon: '🧪',
    title: 'CHEMISTRY CBT EXAMINATION',
    instructions: 'Answer all questions. Chemical formulas, valence states, and standard conditions apply.',
    font: 'Arial',
  },
  {
    id: 'physics',
    name: 'Physics',
    icon: '⚡',
    title: 'PHYSICS CBT EXAMINATION',
    instructions: 'Answer all questions. Take acceleration due to gravity g = 10m/s² where applicable.',
    font: 'Calibri',
  },
  {
    id: 'ict',
    name: 'Computer Studies / ICT',
    icon: '💻',
    title: 'COMPUTER STUDIES CBT EXAMINATION',
    instructions: 'Answer all questions. Practical computer shortcuts, software commands, and hardware concepts apply.',
    font: 'Calibri',
  },
  {
    id: 'economics',
    name: 'Economics',
    icon: '📊',
    title: 'ECONOMICS CBT EXAMINATION',
    instructions: 'Answer all questions. Economic curves, tables, and market schedules should be evaluated carefully.',
    font: 'Calibri',
  },
  {
    id: 'civic',
    name: 'Civic Education',
    icon: '🏛️',
    title: 'CIVIC EDUCATION CBT EXAMINATION',
    instructions: 'Answer all questions on democratic values, national symbols, and human rights.',
    font: 'Calibri',
  },
];

function detectSubjectAndClass(fileName: string): { subject?: string; classLevel?: string } {
  const lower = fileName.toLowerCase();
  let sub: string | undefined;
  let cls: string | undefined;

  if (lower.includes('further') || lower.includes('fmath') || lower.includes('f_math')) {
    sub = 'FURTHER MATHEMATICS';
  } else if (lower.includes('math') || lower.includes('arith')) {
    sub = 'MATHEMATICS';
  } else if (lower.includes('yoruba') || lower.includes('ede') || lower.includes('asa')) {
    sub = 'YORÙBÁ';
  } else if (lower.includes('english') || lower.includes('eng') || lower.includes('lit')) {
    sub = 'ENGLISH LANGUAGE';
  } else if (lower.includes('bio')) {
    sub = 'BIOLOGY';
  } else if (lower.includes('chem')) {
    sub = 'CHEMISTRY';
  } else if (lower.includes('phy')) {
    sub = 'PHYSICS';
  } else if (lower.includes('computer') || lower.includes('ict') || lower.includes('data')) {
    sub = 'COMPUTER STUDIES / ICT';
  } else if (lower.includes('econ')) {
    sub = 'ECONOMICS';
  } else if (lower.includes('civic') || lower.includes('gov')) {
    sub = 'CIVIC EDUCATION';
  } else if (lower.includes('agric')) {
    sub = 'AGRICULTURAL SCIENCE';
  }

  const classMatch = lower.match(/\b(ss\s*[1-3]|jss\s*[1-3]|year\s*\d+|grade\s*\d+|basic\s*\d+)\b/);
  if (classMatch) {
    cls = classMatch[1].toUpperCase().replace(/\s+/g, ' ');
  }

  return { subject: sub, classLevel: cls };
}

export default function CBTFlowApp() {
  // Preset & Configuration State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('standard');
  const [schoolName, setSchoolName] = useState<string>('EXCELLENCE ACADEMY');
  const [subject, setSubject] = useState<string>('MATHEMATICS');
  const [classLevel, setClassLevel] = useState<string>('SS 2');
  const [templateTitle, setTemplateTitle] = useState<string>('CBT EXAM QUESTIONS TEMPLATE');
  const [instructions, setInstructions] = useState<string>(
    'Instructions for Teachers: Type each question number (e.g. 1.), followed by options A, B, C, D, and write ANSWER: [Letter] below the options.'
  );
  const [optionPrefix, setOptionPrefix] = useState<'A)' | 'A.' | '(A)'>('A)');
  const [fontName, setFontName] = useState<string>('Calibri');

  // Input & Processing State
  const [activeTab, setActiveTab] = useState<'files' | 'text'>('files');
  const [rawText, setRawText] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Results State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [batchResults, setBatchResults] = useState<BatchFileResult[]>([]);
  const [activeFileName, setActiveFileName] = useState<string>('');
  const [batchZipBlob, setBatchZipBlob] = useState<Blob | null>(null);
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);
  const [mobileActiveView, setMobileActiveView] = useState<'editor' | 'preview'>('editor');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadTemplate = async () => {
    const blob = await generateGuideTemplateDocxBlob({
      schoolName,
      templateTitle,
      instructions,
      optionPrefix,
      fontName,
      subject,
      classLevel,
    });
    const subSlug = subject ? `_${subject.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    triggerDownload(blob, `${schoolName.replace(/\s+/g, '_')}${subSlug}_Official_CBT_Template.docx`);
  };

  // Apply Preset
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = PRESETS.find((x) => x.id === presetId);
    if (p) {
      setSchoolName(p.schoolName);
      setTemplateTitle(p.templateTitle);
      setInstructions(p.instructions);
      setOptionPrefix(p.optionPrefix);
      setFontName(p.fontName);
      if (p.subject) setSubject(p.subject);
      if (p.classLevel) setClassLevel(p.classLevel);
    }
  };

  // Apply Subject Preset
  const handleSubjectSelect = (subId: string) => {
    const target = SUBJECT_PRESETS.find((x) => x.id === subId);
    if (target) {
      setSubject(target.name.toUpperCase());
      setTemplateTitle(target.title);
      setInstructions(target.instructions);
      if (target.font) {
        setFontName(target.font);
      }
    }
  };

  // Load Built-in Samples
  const handleLoadSample = () => {
    setRawText(SAMPLE_TEXT);
    setActiveTab('text');
    const parsed = parseText(SAMPLE_TEXT);
    if (parsed.length >= 3) {
      parsed[2].image = SAMPLE_MATH_DIAGRAM;
    }
    setQuestions(parsed);
    setBatchZipBlob(null);
    setBatchResults([]);
    setActiveFileName('Sample_STEM_Exam.txt');
    setMobileActiveView('preview');
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
  };

  // File Drop / Selection with Auto-Subject Detection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);

      // Auto-detect subject and class from the first uploaded file name
      const detected = detectSubjectAndClass(files[0].name);
      if (detected.subject) {
        setSubject(detected.subject);
        const subMatch = SUBJECT_PRESETS.find((x) => x.name.toUpperCase() === detected.subject);
        if (subMatch) {
          setTemplateTitle(subMatch.title);
          setInstructions(subMatch.instructions);
          if (subMatch.font) {
            setFontName(subMatch.font);
          }
        }
      }
      if (detected.classLevel) {
        setClassLevel(detected.classLevel);
      }
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Process Raw Text
  const handleProcessText = () => {
    if (!rawText.trim()) return;
    const parsed = parseText(rawText);
    setQuestions(parsed);
    setBatchZipBlob(null);
    setBatchResults([]);
    setActiveFileName('Pasted_Questions.txt');
    setMobileActiveView('preview');
  };

  // Process Batch Files
  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);

    const exportOpts: ExportOptions = {
      schoolName,
      templateTitle,
      instructions,
      optionPrefix,
      fontName,
      subject,
      classLevel,
    };

    const results: BatchFileResult[] = [];

    for (const file of selectedFiles) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');
      const detected = detectSubjectAndClass(file.name);
      const fileSub = detected.subject || subject;
      const fileCls = detected.classLevel || classLevel;

      try {
        let qs: Question[] = [];
        if (file.name.toLowerCase().endsWith('.docx')) {
          const res = await parseDocxFile(file);
          qs = res.questions;
        } else {
          const text = await file.text();
          qs = parseText(text);
        }

        const warningsCount = qs.reduce((acc, q) => acc + q.warnings.length, 0);
        results.push({
          fileName: file.name,
          cleanName,
          subject: fileSub,
          classLevel: fileCls,
          questions: qs,
          warningsCount,
          success: true,
        });
      } catch (err: any) {
        results.push({
          fileName: file.name,
          cleanName,
          subject: fileSub,
          classLevel: fileCls,
          questions: [],
          warningsCount: 0,
          success: false,
          error: err.message || 'Failed to parse',
        });
      }
    }

    setBatchResults(results);

    // Set first valid result as current active preview
    const firstValid = results.find((r) => r.success && r.questions.length > 0);
    if (firstValid) {
      setQuestions(firstValid.questions);
      setActiveFileName(firstValid.fileName);
      setMobileActiveView('preview');
    }

    // Build Master ZIP
    try {
      const zip = await generateBatchZipBlob(results, exportOpts);
      setBatchZipBlob(zip);
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
    } catch (e) {
      console.error('Error generating batch zip', e);
    }

    setIsProcessing(false);
  };

  // Inline Answer Toggle / Edit
  const handleQuickAnswerChange = (qIndex: number, newAnswer: string) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = { ...next[qIndex], answer: newAnswer };
      // re-check warnings
      target.warnings = target.warnings.filter((w) => !w.includes('Missing correct answer'));
      next[qIndex] = target;
      return next;
    });
  };

  const handleImageUpload = (qIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setQuestions((prev) => {
          const next = [...prev];
          next[qIndex] = { ...next[qIndex], image: dataUrl };
          return next;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = (qIndex: number) => {
    setQuestions((prev) => {
      const next = [...prev];
      const target = { ...next[qIndex] };
      delete target.image;
      next[qIndex] = target;
      return next;
    });
  };

  // Download Helpers
  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleDownloadDocx = async () => {
    if (questions.length === 0) return;
    const blob = await generateDocxBlob(questions, {
      schoolName,
      templateTitle,
      instructions,
      optionPrefix,
      fontName,
      subject,
      classLevel,
    });
    const subSlug = subject ? `_${subject.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    triggerDownload(blob, `${schoolName.replace(/\s+/g, '_')}${subSlug}_CBT_Exam.docx`);
  };

  const handleDownloadAiken = () => {
    if (questions.length === 0) return;
    const text = generateAikenText(questions, schoolName);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const subSlug = subject ? `_${subject.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    triggerDownload(blob, `${schoolName.replace(/\s+/g, '_')}${subSlug}_Aiken.txt`);
  };

  const handleDownloadExcel = () => {
    if (questions.length === 0) return;
    const blob = generateExcelBlob(questions);
    const subSlug = subject ? `_${subject.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    triggerDownload(blob, `${schoolName.replace(/\s+/g, '_')}${subSlug}_CBT_Matrix.xlsx`);
  };

  const handleDownloadZip = () => {
    if (!batchZipBlob) return;
    const subSlug = subject ? `_${subject.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
    triggerDownload(batchZipBlob, `${schoolName.replace(/\s+/g, '_')}${subSlug}_Batch_CBT_Exams.zip`);
  };

  const totalWarnings = questions.reduce((acc, q) => acc + q.warnings.length, 0);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black text-xl">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight text-white">CBTFlow</span>
                <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Online & Free
                </span>
              </div>
              <p className="text-xs text-slate-400">Universal Word to CBT Exam Converter</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* School Preset Selector */}
            <div className="relative hidden md:block">
              <select
                value={selectedPresetId}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="text-xs bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleDownloadTemplate}
              className="text-xs flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold shadow-sm transition"
              title="Download pre-formatted Microsoft Word template"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-950" />
              <span className="hidden sm:inline">Download Template (.docx)</span>
              <span className="sm:hidden">Template</span>
            </button>

            <button
              onClick={() => setShowGuideModal(true)}
              className="text-xs flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="View CBT Format Guidelines"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Format Guide</span>
            </button>

            <button
              onClick={handleLoadSample}
              className="text-xs flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Load Sample</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Mobile View Switcher Tab (Visible on mobile/tablet < lg) */}
        <div className="lg:hidden col-span-12 flex bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-semibold shadow-md">
          <button
            onClick={() => setMobileActiveView('editor')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center space-x-2 ${
              mobileActiveView === 'editor'
                ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Upload & Settings</span>
          </button>
          <button
            onClick={() => setMobileActiveView('preview')}
            className={`flex-1 py-2.5 rounded-xl transition flex items-center justify-center space-x-2 ${
              mobileActiveView === 'preview'
                ? 'bg-amber-400 text-slate-950 shadow-md font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Live Preview {questions.length > 0 && `(${questions.length})`}</span>
          </button>
        </div>

        {/* Left Column: Formatter Controls & Ingestion (5 cols) */}
        <section className={`lg:col-span-5 space-y-6 ${mobileActiveView === 'editor' ? 'col-span-12' : 'hidden lg:block'}`}>
          {/* Preset & Customization Card */}
          <div className="bg-slate-950/60 rounded-2xl p-4 sm:p-5 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm">
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Template & School Profile</span>
              </div>
              <span className="text-[11px] font-medium text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                Customizable
              </span>
            </div>

            <div className="space-y-3">
              {/* Mobile Preset Selector */}
              <div className="md:hidden">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Preset Profile
                </label>
                <select
                  value={selectedPresetId}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-amber-500 font-medium"
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  School / Institution Name
                </label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value.toUpperCase())}
                  placeholder="e.g. GREENFIELD COLLEGE / ST. MARY'S HIGH SCHOOL"
                  className="w-full text-sm font-semibold px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 text-white uppercase tracking-wide"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Exam Title / Heading
                </label>
                <input
                  type="text"
                  value={templateTitle}
                  onChange={(e) => setTemplateTitle(e.target.value.toUpperCase())}
                  placeholder="e.g. CBT EXAM QUESTIONS TEMPLATE"
                  className="w-full text-xs font-medium px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 text-slate-200 uppercase"
                />
              </div>

              {/* Subject & Class Specification */}
              <div className="space-y-2 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-slate-300">
                    Subject / Course & Class
                  </label>
                  <span className="text-[10px] text-amber-400 font-semibold">
                    Auto-configured with subject presets
                  </span>
                </div>

                {/* Quick Subject Pills */}
                <div className="flex flex-wrap gap-1 pb-0.5">
                  {[
                    { id: 'math', name: 'Maths', icon: '📐' },
                    { id: 'english', name: 'English', icon: '📖' },
                    { id: 'yoruba', name: 'Yorùbá', icon: '🌍' },
                    { id: 'fmath', name: 'Further Maths', icon: '🔬' },
                    { id: 'biology', name: 'Biology', icon: '🧬' },
                    { id: 'physics', name: 'Physics', icon: '⚡' },
                    { id: 'ict', name: 'ICT', icon: '💻' },
                  ].map((subItem) => (
                    <button
                      key={subItem.id}
                      type="button"
                      onClick={() => handleSubjectSelect(subItem.id)}
                      className={`text-[11px] px-2 py-0.5 rounded-lg border transition font-medium flex items-center space-x-1 ${
                        subject.toUpperCase() === subItem.name.toUpperCase() ||
                        (subItem.id === 'yoruba' && subject.toUpperCase().includes('YOR')) ||
                        (subItem.id === 'fmath' && subject.toUpperCase().includes('FURTHER')) ||
                        (subItem.id === 'math' && subject.toUpperCase() === 'MATHEMATICS') ||
                        (subItem.id === 'english' && subject.toUpperCase().includes('ENGLISH'))
                          ? 'bg-amber-400 text-slate-950 border-amber-400 font-bold shadow-xs'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      <span>{subItem.icon}</span>
                      <span>{subItem.name}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value.toUpperCase())}
                      placeholder="e.g. MATHEMATICS, ENGLISH, YORÙBÁ..."
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 text-white uppercase tracking-wide"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={classLevel}
                      onChange={(e) => setClassLevel(e.target.value.toUpperCase())}
                      placeholder="Class (SS 2)"
                      className="w-full text-xs font-semibold px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 text-white uppercase tracking-wide text-center"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Instructions for Teachers / Candidates
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 text-slate-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Option Style
                  </label>
                  <select
                    value={optionPrefix}
                    onChange={(e) => setOptionPrefix(e.target.value as any)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 text-slate-200"
                  >
                    <option value="A)">A) B) C) D)</option>
                    <option value="A.">A. B. C. D.</option>
                    <option value="(A)">(A) (B) (C) (D)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Font Family
                  </label>
                  <select
                    value={fontName}
                    onChange={(e) => setFontName(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-amber-500 text-slate-200"
                  >
                    <option value="Calibri">Calibri</option>
                    <option value="Arial">Arial</option>
                    <option value="Times New Roman">Times New Roman</option>
                    <option value="Segoe UI">Segoe UI</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Official CBT Format Specification & Template Download Card */}
          <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/30 rounded-2xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Info className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Required CBT Question Format</span>
              </div>
              <button
                onClick={() => setShowGuideModal(true)}
                className="text-[11px] text-amber-300 hover:text-amber-200 underline font-medium flex items-center space-x-1"
              >
                <span>Read Rules</span>
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              For your school CBT system, questions must be arranged in this exact format. You can download the blank template or upload your draft below:
            </p>

            {/* Visual Example Box */}
            <div className="bg-slate-950/90 rounded-xl p-3 border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
              <div className="text-amber-300 font-bold">1. What is the capital city of Nigeria?</div>
              <div className="pl-3 text-slate-400">A) Lagos</div>
              <div className="pl-3 text-slate-400">B) Abuja</div>
              <div className="pl-3 text-slate-400">C) Ibadan</div>
              <div className="pl-3 text-slate-400">D) Kano</div>
              <div className="pl-3 text-blue-400 font-bold">ANSWER: B</div>
            </div>

            <div className="pt-1">
              <button
                onClick={handleDownloadTemplate}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition flex items-center justify-center space-x-2"
              >
                <FileDown className="w-4 h-4 text-slate-950" />
                <span>Download Blank Word Template (.docx)</span>
              </button>
              <p className="text-[10px] text-slate-400 text-center mt-1.5">
                Pre-filled with school headers & instructions — just open in Microsoft Word and type!
              </p>
            </div>
          </div>

          {/* Upload & Ingestion Card */}
          <div className="bg-slate-950/60 rounded-2xl p-5 border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
              <div className="flex items-center space-x-2 text-slate-200 font-semibold text-sm">
                <UploadCloud className="w-4 h-4 text-blue-400" />
                <span>Upload Question Files</span>
              </div>
              <div className="flex bg-slate-900 p-0.5 rounded-lg text-xs font-medium border border-slate-800">
                <button
                  onClick={() => setActiveTab('files')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    activeTab === 'files'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Files (.docx)
                </button>
                <button
                  onClick={() => setActiveTab('text')}
                  className={`px-2.5 py-1 rounded-md transition ${
                    activeTab === 'text'
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Paste Text
                </button>
              </div>
            </div>

            {/* Files Mode */}
            {activeTab === 'files' ? (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-amber-500/60 bg-slate-900/40 hover:bg-amber-500/5 transition-all rounded-xl p-6 text-center cursor-pointer flex flex-col items-center justify-center"
                >
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 mb-2">
                    <FileCheck className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-slate-200">
                    Drag & Drop teacher Word (.docx) files here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Upload 1 or multiple files for batch processing
                  </p>
                  <p className="text-[10px] text-emerald-400 mt-1.5 flex items-center justify-center space-x-1 font-medium bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    <span>Auto-extracts diagrams, tables & bottom answer keys (e.g. 1. A 2. C 3. D...)</span>
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".docx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <button
                    type="button"
                    className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200"
                  >
                    Browse Files
                  </button>
                </div>

                {/* Selected Files Queue */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {selectedFiles.map((f, i) => {
                      const detected = detectSubjectAndClass(f.name);
                      return (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="font-medium text-slate-200 truncate">{f.name}</span>
                            <span className="text-[10px] text-slate-500 flex-shrink-0">
                              ({(f.size / 1024).toFixed(1)} KB)
                            </span>
                            {detected.subject && (
                              <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.2 rounded font-semibold flex-shrink-0">
                                {detected.subject}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeFile(i)}
                            className="text-slate-500 hover:text-red-400 p-1 flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedFiles.length > 0 && (
                  <button
                    disabled={isProcessing}
                    onClick={handleProcessFiles}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-bold text-xs tracking-wide shadow-md transition flex items-center justify-center space-x-2 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>
                      {isProcessing
                        ? 'Converting Files...'
                        : `Convert ${selectedFiles.length} File${
                            selectedFiles.length > 1 ? 's' : ''
                          }`}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              /* Text Mode */
              <div className="space-y-3">
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste teacher exam questions here in any format..."
                  className="w-full text-xs font-mono px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none focus:border-amber-500 text-slate-200"
                />
                <button
                  onClick={handleProcessText}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs tracking-wide shadow-md transition flex items-center justify-center space-x-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>Parse & Generate CBT Layout</span>
                </button>
              </div>
            )}
          </div>

          {/* Download Center Card */}
          {questions.length > 0 && (
            <div className="bg-gradient-to-br from-slate-950 to-slate-900 text-white rounded-2xl p-5 shadow-lg border border-slate-800 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center space-x-2">
                  <Download className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-bold">Download Ready Exports</span>
                </div>
                <span className="text-[11px] bg-amber-400/20 text-amber-300 font-mono px-2 py-0.5 rounded border border-amber-400/30">
                  {questions.length} Questions
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  onClick={handleDownloadDocx}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 transition group"
                >
                  <FileText className="w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-xs font-semibold text-white">Word (.docx)</span>
                  <span className="text-[10px] text-slate-400">Clean Template</span>
                </button>

                <button
                  onClick={handleDownloadAiken}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 transition group"
                >
                  <Terminal className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-xs font-semibold text-white">Aiken (.txt)</span>
                  <span className="text-[10px] text-slate-400">Moodle & LMS</span>
                </button>

                <button
                  onClick={handleDownloadExcel}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-green-500/50 transition group"
                >
                  <Table className="w-5 h-5 text-green-400 group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-xs font-semibold text-white">Excel (.xlsx)</span>
                  <span className="text-[10px] text-slate-400">CBT Matrix</span>
                </button>
              </div>

              {/* Master Batch ZIP */}
              {batchZipBlob && (
                <div className="pt-2 border-t border-slate-800">
                  <button
                    onClick={handleDownloadZip}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition flex items-center justify-center space-x-2"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Download All Files as Master ZIP (.zip)</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Right Column: Live Interactive Preview Sheet (7 cols) */}
        <section className={`lg:col-span-7 flex flex-col space-y-4 ${mobileActiveView === 'preview' ? 'col-span-12' : 'hidden lg:flex'}`}>
          {/* Status Header */}
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-slate-800 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-amber-400 font-extrabold text-xs">
                {questions.length}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-200">
                  {activeFileName || 'Live Document Preview'}
                </h2>
                <p className="text-[11px] text-slate-400">
                  {questions.length > 0
                    ? `${questions.length} questions formatted to standard`
                    : 'Awaiting upload or pasted text...'}
                </p>
              </div>
            </div>

            {questions.length > 0 && (
              <div className="flex items-center space-x-2">
                {questions.some((q) => !!q.image) && (
                  <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded-lg font-medium flex items-center space-x-1">
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>
                      {questions.filter((q) => !!q.image).length} Diagram{questions.filter((q) => !!q.image).length > 1 ? 's' : ''} Extracted
                    </span>
                  </span>
                )}
                {totalWarnings === 0 ? (
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-medium flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>100% Validated</span>
                  </span>
                ) : (
                  <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg font-medium flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{totalWarnings} Alerts</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Virtual Document Paper */}
          <div className="bg-white text-slate-900 rounded-2xl border border-slate-800 shadow-xl p-4 sm:p-8 flex-1 overflow-y-auto max-h-[600px] sm:max-h-[750px] space-y-6">
            {/* School Header */}
            <div className="text-center pb-4 border-b border-slate-200 space-y-1.5">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-wide uppercase">
                {schoolName}
              </h1>
              <h2 className="text-xs sm:text-sm font-bold text-blue-900 uppercase">{templateTitle}</h2>
              {subject && (
                <div className="inline-flex items-center space-x-2 bg-blue-50 text-blue-900 border border-blue-200 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider my-0.5 shadow-2xs">
                  <span>SUBJECT: {subject}</span>
                  {classLevel && <span className="text-blue-300">•</span>}
                  {classLevel && <span>CLASS: {classLevel}</span>}
                </div>
              )}
              {instructions && (
                <p className="text-xs text-slate-500 italic max-w-xl mx-auto pt-1">{instructions}</p>
              )}
            </div>

            {/* Questions List */}
            {questions.length === 0 ? (
              <div className="py-16 sm:py-20 text-center text-slate-400 space-y-2">
                <FileText className="w-12 h-12 mx-auto text-slate-300 stroke-1" />
                <p className="text-sm font-medium text-slate-600">No questions loaded yet</p>
                <p className="text-xs text-slate-400">
                  Upload a Word document or click &quot;Load Sample&quot; to test the live preview.
                </p>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-5">
                {questions.map((q, idx) => {
                  const qNum = idx + 1;
                  const optionKeys = Object.keys(q.options).sort();
                  const displayKeys = optionKeys.length > 0 ? optionKeys : ['A', 'B', 'C', 'D'];
                  const ans = (q.answer || '').toUpperCase();

                  return (
                    <div
                      key={q.id || idx}
                      className={`p-3.5 sm:p-4 rounded-xl border ${
                        q.warnings.length > 0
                          ? 'border-amber-200 bg-amber-50/20'
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50/40'
                      } transition space-y-2.5`}
                    >
                      {/* Question Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-2 flex-1">
                          <span className="font-extrabold text-sm text-slate-900">{qNum}.</span>
                          <span className="text-sm font-semibold text-slate-800 leading-snug whitespace-pre-line">{q.stem}</span>
                        </div>
                      </div>

                      {/* Render Diagram / Scientific Figure if auto-extracted from Word or attached */}
                      {q.image && (
                        <div className="my-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 inline-block max-w-full">
                          <div className="flex items-center justify-between gap-3 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2.5 py-1 rounded-lg">
                            <span className="flex items-center space-x-1.5 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                              <span>Diagram auto-extracted from Word</span>
                            </span>
                            <div className="flex items-center space-x-2">
                              <label className="cursor-pointer text-slate-500 hover:text-slate-800 text-[10px] underline font-medium">
                                Replace
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => handleImageUpload(idx, e)}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(idx)}
                                className="text-red-500 hover:text-red-700 text-[10px] underline font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          <img
                            src={q.image}
                            alt={`Diagram for Question ${qNum}`}
                            className="max-h-64 max-w-full rounded-lg object-contain bg-white shadow-xs border border-slate-100"
                          />
                        </div>
                      )}

                      {/* Warnings */}
                      {q.warnings.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {q.warnings.map((w, wIdx) => (
                            <span
                              key={wIdx}
                              className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md font-medium flex items-center space-x-1"
                            >
                              <AlertTriangle className="w-3 h-3" />
                              <span>{w}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Options */}
                      <div className="space-y-1 pl-2 sm:pl-4 text-xs">
                        {displayKeys.map((k) => {
                          const val = q.options[k] || '';
                          const prefix =
                            optionPrefix === 'A.'
                              ? `${k}.`
                              : optionPrefix === '(A)'
                              ? `(${k})`
                              : `${k})`;
                          return (
                            <div key={k} className="flex items-start space-x-2 py-0.5">
                              <span className="font-bold text-slate-700 w-5 flex-shrink-0">
                                {prefix}
                              </span>
                              <span className="text-slate-700">{val}</span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Answer Indicator & Quick Picker */}
                      <div className="pl-2 sm:pl-4 pt-1 flex flex-wrap items-center justify-between gap-2 text-xs border-t border-slate-100/60 mt-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-blue-700">ANSWER:</span>
                          <div className="flex items-center space-x-1.5">
                            {['A', 'B', 'C', 'D'].map((letter) => (
                              <button
                                key={letter}
                                onClick={() => handleQuickAnswerChange(idx, letter)}
                                className={`min-w-[32px] h-8 sm:h-7 sm:px-2.5 rounded-lg font-bold transition text-xs flex items-center justify-center ${
                                  ans === letter
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 active:scale-95'
                                }`}
                              >
                                {letter}
                              </button>
                            ))}
                            {!ans && (
                              <span className="text-[10px] text-red-600 font-semibold italic pl-1">
                                (Tap to set)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Optional discreet diagram adder only if question has no diagram */}
                        {!q.image && (
                          <label className="cursor-pointer text-[10px] text-slate-400 hover:text-blue-600 flex items-center space-x-1 transition">
                            <ImageIcon className="w-3 h-3 text-slate-400" />
                            <span>+ Add optional diagram</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleImageUpload(idx, e)}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Format Guide Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl relative">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">CBT Question Format Guide</h3>
                <p className="text-xs text-slate-400">Strict rules required for school CBT software ingestion</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">1</span>
                <div>
                  <strong className="text-white">Question Number:</strong> Start each question with a number and period (e.g. <code className="text-amber-300">1. What is...</code>).
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">2</span>
                <div>
                  <strong className="text-white">Options:</strong> Put options on their own lines labeled <code className="text-amber-300">A)</code>, <code className="text-amber-300">B)</code>, <code className="text-amber-300">C)</code>, <code className="text-amber-300">D)</code>.
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">3</span>
                <div>
                  <strong className="text-white">Answer Keys (Flexible):</strong> Either write <code className="text-blue-400">ANSWER: [Letter]</code> beneath each question, <strong className="text-amber-300">OR</strong> list all answers together at the bottom (e.g. <code className="text-amber-300">1. A 2. C 3. D 4. E</code> or under <code className="text-amber-300">ANSWERS:</code>). CBTFlow automatically connects each answer to its question!
                </div>
              </div>

              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center flex-shrink-0 text-[11px]">4</span>
                <div>
                  <strong className="text-white">Diagrams & Tables:</strong> You do <span className="text-emerald-300 font-semibold">NOT</span> need to manually upload pictures! Just paste your diagrams, biological figures, or math tables directly inside your Word document. CBTFlow automatically extracts and attaches them to the right question.
                </div>
              </div>
            </div>

            {/* Example snippet */}
            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
              <div className="text-amber-300">1. What is the capital city of Nigeria?</div>
              <div className="pl-3 text-slate-400">A) Lagos</div>
              <div className="pl-3 text-slate-400">B) Abuja</div>
              <div className="pl-3 text-slate-400">C) Ibadan</div>
              <div className="pl-3 text-slate-400">D) Kano</div>
              <div className="pl-3 text-blue-400 font-bold">ANSWER: B</div>
            </div>

            <div className="flex space-x-2.5 pt-2">
              <button
                onClick={() => {
                  handleDownloadTemplate();
                  setShowGuideModal(false);
                }}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md transition flex items-center justify-center space-x-2"
              >
                <FileDown className="w-4 h-4 text-slate-950" />
                <span>Download Word Template</span>
              </button>
              <button
                onClick={() => setShowGuideModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 py-3 text-center text-xs text-slate-500 bg-slate-950">
        CBTFlow • Universal CBT & Exam Word Converter • 100% Free & Open For All Schools
      </footer>
    </div>
  );
}
