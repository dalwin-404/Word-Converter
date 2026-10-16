import { Document, Paragraph, TextRun, ImageRun, AlignmentType, Packer } from 'docx';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { Question, BatchFileResult } from './types';

export interface ExportOptions {
  schoolName: string;
  templateTitle: string;
  instructions: string;
  optionPrefix: 'A)' | 'A.' | '(A)';
  fontName: string;
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const pureBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const binaryString = atob(pureBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function generateDocxBlob(questions: Question[], options: ExportOptions): Promise<Blob> {
  const paragraphs: Paragraph[] = [];

  // 1. School Header
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [
        new TextRun({
          text: `${options.schoolName.toUpperCase()} - ${options.templateTitle.toUpperCase()}`,
          bold: true,
          size: 28, // 14pt
          font: options.fontName,
          color: '1A365D',
        }),
      ],
    })
  );

  // 2. Instructions
  if (options.instructions) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 50, after: 250 },
        children: [
          new TextRun({
            text: options.instructions,
            italics: true,
            size: 20, // 10pt
            font: options.fontName,
            color: '4A5568',
          }),
        ],
      })
    );
  }

  // 3. Question Blocks
  questions.forEach((q, idx) => {
    const qNum = idx + 1;

    // Question Stem: e.g. "1. What is the capital of Nigeria?"
    paragraphs.push(
      new Paragraph({
        spacing: { before: 180, after: 60 },
        children: [
          new TextRun({
            text: `${qNum}. `,
            bold: true,
            size: 22, // 11pt
            font: options.fontName,
          }),
          new TextRun({
            text: q.stem,
            size: 22,
            font: options.fontName,
          }),
        ],
      })
    );

    // Embedded Diagram / Science Image
    if (q.image) {
      try {
        const imgBytes = base64ToUint8Array(q.image);
        const imgType: 'png' | 'jpg' | 'gif' =
          q.image.includes('image/jpeg') || q.image.includes('image/jpg')
            ? 'jpg'
            : q.image.includes('image/gif')
            ? 'gif'
            : 'png';

        paragraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 80, after: 120 },
            children: [
              new ImageRun({
                data: imgBytes,
                transformation: {
                  width: 320,
                  height: 200,
                },
                type: imgType,
              }),
            ],
          })
        );
      } catch (err) {
        console.warn('Failed to embed diagram in docx', err);
      }
    }

    // Options A, B, C, D
    const optionKeys = Object.keys(q.options).sort();
    const displayKeys = optionKeys.length > 0 ? optionKeys : ['A', 'B', 'C', 'D'];

    displayKeys.forEach((key) => {
      const val = q.options[key] || '';
      let prefix = `${key}) `;
      if (options.optionPrefix === 'A.') prefix = `${key}. `;
      if (options.optionPrefix === '(A)') prefix = `(${key}) `;

      paragraphs.push(
        new Paragraph({
          indent: { left: 400 },
          spacing: { before: 20, after: 20 },
          children: [
            new TextRun({
              text: prefix,
              bold: true,
              size: 22,
              font: options.fontName,
            }),
            new TextRun({
              text: val,
              size: 22,
              font: options.fontName,
            }),
          ],
        })
      );
    });

    // Answer Line: e.g. "ANSWER: B"
    const ans = (q.answer || '').toUpperCase();
    paragraphs.push(
      new Paragraph({
        indent: { left: 400 },
        spacing: { before: 40, after: 200 },
        children: [
          new TextRun({
            text: 'ANSWER: ',
            bold: true,
            size: 22,
            font: options.fontName,
            color: '2B6CB0',
          }),
          new TextRun({
            text: ans || '[UNSET]',
            bold: true,
            size: 22,
            font: options.fontName,
            color: ans ? '2B6CB0' : 'E53E3E',
          }),
        ],
      })
    );
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1000,
              bottom: 1000,
              left: 1200,
              right: 1200,
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export async function generateGuideTemplateDocxBlob(options: ExportOptions): Promise<Blob> {
  const guideQuestions: Question[] = [
    {
      id: 1,
      number: 1,
      stem: "What is the capital city of Nigeria?",
      options: { A: "Lagos", B: "Abuja", C: "Ibadan", D: "Kano" },
      answer: "B",
      warnings: [],
    },
    {
      id: 2,
      number: 2,
      stem: "Which organ in the human body is responsible for pumping blood?",
      options: { A: "Lungs", B: "Liver", C: "Heart", D: "Kidney" },
      answer: "C",
      warnings: [],
    },
    {
      id: 3,
      number: 3,
      stem: "What is the value of 15 multiplied by 4?",
      options: { A: "45", B: "50", C: "55", D: "60" },
      answer: "D",
      warnings: [],
    },
    {
      id: 4,
      number: 4,
      stem: "What is the chemical formula for water?",
      options: { A: "CO2", B: "NaCl", C: "H2O", D: "O2" },
      answer: "C",
      warnings: [],
    },
    {
      id: 5,
      number: 5,
      stem: "Which continent is Nigeria located in?",
      options: { A: "Asia", B: "Africa", C: "Europe", D: "South America" },
      answer: "B",
      warnings: [],
    },
  ];

  return await generateDocxBlob(guideQuestions, options);
}

export function generateAikenText(questions: Question[], schoolName: string): string {
  const lines: string[] = [
    `// ${schoolName.toUpperCase()} - AIKEN CBT EXAM QUESTIONS`,
    '',
  ];

  questions.forEach((q, idx) => {
    lines.push(`${idx + 1}. ${q.stem}`);
    if (q.image) {
      lines.push(`// [IMAGE ATTACHED FOR QUESTION ${idx + 1}]`);
    }
    const keys = Object.keys(q.options).sort();
    keys.forEach((key) => {
      lines.push(`${key}) ${q.options[key]}`);
    });
    lines.push(`ANSWER: ${(q.answer || 'A').toUpperCase()}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function generateExcelBlob(questions: Question[]): Blob {
  const data = questions.map((q, idx) => ({
    'S/N': idx + 1,
    Question: q.stem,
    'Option A': q.options['A'] || '',
    'Option B': q.options['B'] || '',
    'Option C': q.options['C'] || '',
    'Option D': q.options['D'] || '',
    'Option E': q.options['E'] || '',
    'Correct Answer': q.answer || '',
    'Has Diagram': q.image ? 'Yes' : 'No',
    'Status': q.warnings.length === 0 ? 'OK' : q.warnings.join('; '),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'CBT Questions');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function generateBatchZipBlob(
  files: BatchFileResult[],
  options: ExportOptions
): Promise<Blob> {
  const zip = new JSZip();

  const wordFolder = zip.folder('01_Word_Standardized');
  const aikenFolder = zip.folder('02_Aiken_CBT_Txt');
  const excelFolder = zip.folder('03_Excel_Spreadsheets');
  const diagramsFolder = zip.folder('04_Exam_Diagrams');

  let reportText = `======================================================================\n`;
  reportText += `  ${options.schoolName.toUpperCase()} - CBTFLOW BATCH CONVERSION REPORT\n`;
  reportText += `======================================================================\n`;
  reportText += `Total Files Processed: ${files.length}\n\n`;

  for (const file of files) {
    if (!file.success || file.questions.length === 0) {
      reportText += `✗ [${file.fileName}] Error: ${file.error || 'No questions parsed'}\n\n`;
      continue;
    }

    const docxBlob = await generateDocxBlob(file.questions, options);
    const aikenText = generateAikenText(file.questions, options.schoolName);
    const excelBlob = generateExcelBlob(file.questions);

    wordFolder?.file(`${file.cleanName}_CBT_Standard.docx`, docxBlob);
    aikenFolder?.file(`${file.cleanName}_Aiken.txt`, aikenText);
    excelFolder?.file(`${file.cleanName}_Matrix.xlsx`, excelBlob);

    // Save individual images for CBT portal uploads
    file.questions.forEach((q) => {
      if (q.image) {
        try {
          const imgBytes = base64ToUint8Array(q.image);
          diagramsFolder?.file(`${file.cleanName}_Q${q.number}_diagram.png`, imgBytes);
        } catch (e) {
          console.warn('Failed to save diagram into zip', e);
        }
      }
    });

    reportText += `✓ [${file.cleanName}]\n`;
    reportText += `   • Questions: ${file.questions.length}\n`;
    reportText += `   • Validation Alerts: ${file.warningsCount}\n`;
    if (file.warningsCount > 0) {
      file.questions.forEach((q) => {
        if (q.warnings.length > 0) {
          reportText += `      - Q#${q.number}: ${q.warnings.join('; ')}\n`;
        }
      });
    }
    reportText += '\n';
  }

  zip.file('00_BATCH_SUMMARY_REPORT.txt', reportText);
  return await zip.generateAsync({ type: 'blob' });
}
