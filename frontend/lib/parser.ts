import mammoth from 'mammoth';
import { Question } from './types';

// Regex for question starters: 1., 1), Q1., Question 1:, [1], 1 -
const QUESTION_START_REGEX = /^(?:(?:Question|Q|Ques)\s*[-.:]?\s*(\d+)|\((\d+)\)|\[(\d+)\]|(\d+)\s*[-.:)])\s*(.*)$/i;

// Regex for options (A-E): A), A., (A), [A], a., a), *A), A*)
const OPTION_START_REGEX = /^(?:\*|[✓✔•\-])?\s*(?:\(([A-Ea-e])\)|\[([A-Ea-e])\]|([A-Ea-e])\s*[*]?\s*[-.:)])\s*(.*)$/;

// Regex for inline options: A) ... B) ... C) ... D) ...
const INLINE_OPTIONS_REGEX = /(?:^|\s+)(?:\*|[✓✔•\-])?\s*(?:\(([A-Ea-e])\)|\[([A-Ea-e])\]|([A-Ea-e])\s*[*]?\s*[-.:)])\s*/g;

// Regex for answer indicators: ANSWER: B, Ans: B, Correct: B, Key: B
const ANSWER_REGEX = /^(?:ANSWER|ANS|CORRECT\s*ANSWER|CORRECT|KEY|ANSW)\s*[:=\-]?\s*([A-Ea-e])\b/i;

// Bottom answer keys regex
const BOTTOM_KEY_ITEM_REGEX = /(?:Q?(\d+)\s*[:.-]?\s*([A-Ea-e]))/gi;
const BOTTOM_SECTION_REGEX = /^(?:ANSWER\s+KEYS?|MARKING\s+SCHEME|ANSWERS\s+SHEET)\b/i;

export async function parseDocxFile(file: File): Promise<{ questions: Question[]; rawText: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const rawText = result.value;
  const questions = parseText(rawText);
  return { questions, rawText };
}

export function parseText(rawText: string): Question[] {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const questions: Question[] = [];
  const bottomKeys: { [key: number]: string } = {};

  // First pass: extract bottom answer keys if any
  const keptLines: string[] = [];
  let inBottomKeySection = false;

  for (const line of lines) {
    if (ANSWER_REGEX.test(line)) {
      keptLines.push(line);
      continue;
    }

    if (BOTTOM_SECTION_REGEX.test(line)) {
      inBottomKeySection = true;
      let match;
      const regex = new RegExp(BOTTOM_KEY_ITEM_REGEX);
      while ((match = regex.exec(line)) !== null) {
        bottomKeys[parseInt(match[1], 10)] = match[2].toUpperCase();
      }
      continue;
    }

    if (inBottomKeySection) {
      let match;
      const regex = new RegExp(BOTTOM_KEY_ITEM_REGEX);
      while ((match = regex.exec(line)) !== null) {
        bottomKeys[parseInt(match[1], 10)] = match[2].toUpperCase();
      }
      continue;
    }

    keptLines.push(line);
  }

  let currentQ: Question | null = null;
  let currentOptionLetter: string | null = null;

  for (let i = 0; i < keptLines.length; i++) {
    const text = keptLines[i];

    // 1. Check for single question answer
    const ansMatch = text.match(ANSWER_REGEX);
    if (ansMatch) {
      const ansLetter = ansMatch[1].toUpperCase();
      if (currentQ) {
        currentQ.answer = ansLetter;
      }
      continue;
    }

    // 2. Check for new Question start
    const qMatch = text.match(QUESTION_START_REGEX);
    if (qMatch && !OPTION_START_REGEX.test(text)) {
      if (currentQ) {
        finalizeQuestion(currentQ, bottomKeys);
        questions.push(currentQ);
      }

      const qNumStr = qMatch[1] || qMatch[2] || qMatch[3] || qMatch[4] || '';
      const qNum = parseInt(qNumStr, 10) || questions.length + 1;
      const stem = qMatch[5].trim();

      currentQ = {
        id: questions.length + 1,
        number: qNum,
        stem: stem,
        options: {},
        answer: null,
        warnings: [],
        rawLines: [text]
      };
      currentOptionLetter = null;
      continue;
    }

    // 3. Check for Option line
    const optMatch = text.match(OPTION_START_REGEX);
    if (optMatch && currentQ) {
      const letter = (optMatch[1] || optMatch[2] || optMatch[3]).toUpperCase();
      const remainder = optMatch[4].trim();

      // Check inline options
      const inlineOpts = splitInlineOptions(text);
      if (inlineOpts.length > 1) {
        for (const [inLetter, inVal] of inlineOpts) {
          currentQ.options[inLetter] = inVal;
          if (inVal.startsWith('*') || inLetter.startsWith('*')) {
            currentQ.answer = inLetter.replace('*', '');
            currentQ.options[inLetter] = inVal.replace(/^\*\s*/, '');
          }
        }
        currentOptionLetter = inlineOpts[inlineOpts.length - 1][0];
      } else {
        const isStarred = remainder.startsWith('*') || text.startsWith('*');
        const cleanVal = remainder.replace(/^\*\s*/, '').trim();
        currentQ.options[letter] = cleanVal;
        currentOptionLetter = letter;

        if (isStarred) {
          currentQ.answer = letter;
        }
      }
      currentQ.rawLines?.push(text);
      continue;
    }

    // 4. Check inline option without leading match
    const inlineOpts = splitInlineOptions(text);
    if (inlineOpts.length >= 2 && currentQ) {
      for (const [inLetter, inVal] of inlineOpts) {
        currentQ.options[inLetter] = inVal;
      }
      currentOptionLetter = inlineOpts[inlineOpts.length - 1][0];
      currentQ.rawLines?.push(text);
      continue;
    }

    // 5. Continuation line
    if (currentQ) {
      if (currentOptionLetter && currentQ.options[currentOptionLetter]) {
        currentQ.options[currentOptionLetter] += ' ' + text;
      } else {
        currentQ.stem = currentQ.stem ? currentQ.stem + ' ' + text : text;
      }
      currentQ.rawLines?.push(text);
    }
  }

  // Finalize last question
  if (currentQ) {
    finalizeQuestion(currentQ, bottomKeys);
    questions.push(currentQ);
  }

  // Continuity check
  questions.forEach((q, idx) => {
    const expected = idx + 1;
    if (q.number !== expected) {
      q.warnings.push(`Numbering mismatch: Expected #${expected}, found #${q.number}`);
    }
  });

  return questions;
}

function splitInlineOptions(line: string): [string, string][] {
  const matches: { index: number; letter: string }[] = [];
  const regex = new RegExp(INLINE_OPTIONS_REGEX);
  let match;
  while ((match = regex.exec(line)) !== null) {
    const letter = (match[1] || match[2] || match[3] || '').toUpperCase();
    if (letter) {
      matches.push({ index: match.index + match[0].length, letter });
    }
  }

  if (matches.length <= 1) {
    return [];
  }

  const results: [string, string][] = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].index - 3 : line.length;
    let val = line.substring(current.index, nextStart).trim();
    val = val.replace(/[;,]$/, '').trim();
    results.push([current.letter, val]);
  }
  return results;
}

function finalizeQuestion(q: Question, bottomKeys: { [key: number]: string }) {
  if (!q.answer && bottomKeys[q.number]) {
    q.answer = bottomKeys[q.number];
  }

  const warnings: string[] = [];
  if (!q.answer) {
    warnings.push('Missing correct answer (no ANSWER: tag or marked option found)');
  } else if (!q.options[q.answer]) {
    warnings.push(`Marked answer "${q.answer}" does not match any detected options`);
  }

  const optCount = Object.keys(q.options).length;
  if (optCount < 4) {
    const missing = ['A', 'B', 'C', 'D'].filter(l => !q.options[l]);
    warnings.push(`Incomplete options (${optCount}/4 detected). Missing: ${missing.join(', ')}`);
  }

  q.warnings = warnings;
}
