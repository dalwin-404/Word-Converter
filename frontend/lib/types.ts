export interface Question {
  id: number;
  number: number;
  stem: string;
  options: { [key: string]: string };
  answer: string | null;
  warnings: string[];
  rawLines?: string[];
}

export interface SchoolPreset {
  id: string;
  name: string;
  schoolName: string;
  templateTitle: string;
  instructions: string;
  optionPrefix: 'A)' | 'A.' | '(A)';
  fontName: string;
}

export interface BatchFileResult {
  fileName: string;
  cleanName: string;
  questions: Question[];
  warningsCount: number;
  success: boolean;
  error?: string;
}
