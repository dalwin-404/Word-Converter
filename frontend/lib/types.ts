export interface Question {
  id: number;
  number: number;
  stem: string;
  options: { [key: string]: string };
  answer: string | null;
  warnings: string[];
  rawLines?: string[];
  image?: string; // base64 data URI of diagram/image
}

export interface SchoolPreset {
  id: string;
  name: string;
  schoolName: string;
  templateTitle: string;
  instructions: string;
  optionPrefix: 'A)' | 'A.' | '(A)';
  fontName: string;
  subject?: string;
  classLevel?: string;
}

export interface BatchFileResult {
  fileName: string;
  cleanName: string;
  subject?: string;
  classLevel?: string;
  questions: Question[];
  warningsCount: number;
  success: boolean;
  error?: string;
}
