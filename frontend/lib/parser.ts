import mammoth from 'mammoth';
import { Question } from './types';

// Regex for question starters: 1., 1), Q1., Question 1:, [1], 1 -, No. 1, S/N 1
const QUESTION_START_REGEX = /^(?:(?:Question|Q|Ques|No|S\/N)\s*[-.:]?\s*(\d+)|\((\d+)\)|\[(\d+)\]|(\d+)\s*[-.:)])\s*(.*)$/i;

// Regex for options (A-E): A), A., (A), [A], a., a), *A), A*)
const OPTION_START_REGEX = /^(?:\*|[✓✔•\-])?\s*(?:\(([A-Ea-e])\)|\[([A-Ea-e])\]|([A-Ea-e])\s*[*]?\s*[-.:)])\s*(.*)$/;

// Regex for Roman numerals options: (i), (ii), (iii), (iv), (v) or i., ii., iii., iv.
const ROMAN_OPTION_REGEX = /^(?:\*|[✓✔•\-])?\s*(?:\((i{1,3}|iv|v)\)|\[(i{1,3}|iv|v)\]|(i{1,3}|iv|v)\s*[*]?\s*[-.:)])\s*(.*)$/i;

// Regex for inline options: A) ... B) ... C) ... D) ...
const INLINE_OPTIONS_REGEX = /(?:^|\s+)(?:\*|[✓✔•\-])?\s*(?:\(([A-Ea-e])\)|\[([A-Ea-e])\]|([A-Ea-e])\s*[*]?\s*[-.:)])\s*/g;

// Regex for inline roman numeral options: (i) ... (ii) ... (iii) ... (iv) ...
const INLINE_ROMAN_REGEX = /(?:^|\s+)(?:\*|[✓✔•\-])?\s*(?:\((i{1,3}|iv|v)\)|\[(i{1,3}|iv|v)\]|(i{1,3}|iv|v)\s*[*]?\s*[-.:)])\s*/gi;

// Regex for answer indicators: ANSWER: B, Ans: B, Correct: B, Key: B
const ANSWER_REGEX = /^(?:ANSWER|ANS|CORRECT\s*ANSWER|CORRECT|KEY|ANSW)\s*[:=\-]?\s*([A-Ea-e])\b/i;

// Regex for trailing answer glued to end of line: e.g. "D) Kano Ans: B"
const TRAILING_ANSWER_REGEX = /\s*(?:ANSWER|ANS|CORRECT(?:\s*ANSWER)?|KEY)\s*[:=\-]?\s*([A-Ea-e])\s*$/i;

// Regex for answer glued to next question: e.g. "ANSWER: B 2. What is..."
const GLUED_ANS_NEXT_Q_REGEX = /^(ANSWER|ANS|CORRECT|KEY)\s*[:=\-]?\s*([A-Ea-e])\s+((?:(?:Question|Q|Ques|No)\s*[-.:]?\s*\d+|\(?\d+[-.:)]).+)$/i;

// Comprehensive Bottom Answer Keys Regexes
// Matches headers: "ANSWERS:", "ANSWER KEY", "MARKING SCHEME", "MARKING GUIDE", "SOLUTIONS:", "KEYS:", "CORRECT ANSWERS:"
const BOTTOM_SECTION_HEADER_REGEX = /^(?:ANSWER\s*KEYS?|MARKING\s*(?:SCHEME|GUIDE)|ANSWERS?\s*(?:SHEET)?|SOLUTIONS?|CORRECT\s*ANSWERS?|KEYS?)\s*[:=\-]?\s*(.*)$/i;

// Matches key items: "1. A", "1: B", "1-C", "1) D", "1. (A)", "1. [B]", "Q1: A", "No. 1 = B"
const BOTTOM_KEY_ITEM_REGEX = /(?:^|[\s,;|]+)(?:Q|No\.?)?\s*(\d+)\s*[-.:=|)]\s*\(?\[?([A-Ea-e])\)?\]?(?=$|[\s,;|]+)/gi;

// Matches a single key line: "1. A", "1. a", "1. (A)", "1 - B", or with option text: "1. (c) =", "2. (a) A single page..."
const SINGLE_KEY_LINE_REGEX = /^(?:Q|No\.?)?\s*(\d+)\s*[-.:=|)]\s*\(?\[?([A-Ea-e])\)?\]?(?:\s*[-–—:=]\s*|\s{2,}|\s+|$)(.*)$/i;

const ROMAN_MAP: { [key: string]: string } = {
  i: 'A',
  ii: 'B',
  iii: 'C',
  iv: 'D',
  v: 'E',
};

interface BlockItem {
  type: 'text' | 'image';
  text?: string;
  imageSrc?: string;
}

export async function parseDocxFile(file: File): Promise<{ questions: Question[]; rawText: string }> {
  const arrayBuffer = await file.arrayBuffer();

  // 1. Extract HTML with base64 embedded images
  try {
    const htmlResult = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        convertImage: mammoth.images.imgElement((image) => {
          return image.read("base64").then((imageBuffer) => {
            return {
              src: `data:${image.contentType};base64,${imageBuffer}`,
            };
          });
        }),
      }
    );

    const questions = parseHtmlBlocks(htmlResult.value);
    const textResult = await mammoth.extractRawText({ arrayBuffer });
    return { questions, rawText: textResult.value };
  } catch (err) {
    // Fallback to raw text extraction if convertToHtml has any issue
    const textResult = await mammoth.extractRawText({ arrayBuffer });
    const questions = parseText(textResult.value);
    return { questions, rawText: textResult.value };
  }
}

export function parseHtmlBlocks(html: string): Question[] {
  const blocks: BlockItem[] = [];

  // 1. Convert tables to formatted text rows with pipes (|) and preserve any images inside cells
  let processed = html.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_tableMatch, tableContent) => {
    const rowMatches = tableContent.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi) || [];
    const rows = rowMatches.map((tr: string) => {
      const cellMatches = tr.match(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi) || [];
      const cells = cellMatches.map((cell: string) => {
        const imgMatch = cell.match(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/i);
        let cellText = cell.replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, ' [Diagram] ');
        cellText = cellText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (imgMatch) {
          return `${cellText} \n__CBT_EXTRACTED_IMG__${imgMatch[1]}__END_CBT_IMG__\n`;
        }
        return cellText;
      });
      return cells.filter(Boolean).join(' | ');
    });
    return '\n' + rows.filter(Boolean).join('\n') + '\n';
  });

  // 2. Mark all images (including those inside <p>, <div>, etc.) with unique token
  processed = processed.replace(/<img\b[^>]*src=["']([^"']+)["'][^>]*>/gi, (_match, src) => {
    return `\n__CBT_EXTRACTED_IMG__${src}__END_CBT_IMG__\n`;
  });

  // 3. Convert block closing and break tags to newlines
  processed = processed
    .replace(/<\/(?:p|li|h[1-6]|div)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');

  // 4. Strip remaining HTML tags
  processed = processed.replace(/<[^>]+>/g, ' ');

  // 5. Decode common HTML entities
  processed = processed
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&deg;/g, '°');

  // 6. Split into lines and reconstruct clean block stream
  const lines = processed.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.includes('__CBT_EXTRACTED_IMG__')) {
      const imgMatches = [...trimmed.matchAll(/__CBT_EXTRACTED_IMG__(.*?)__END_CBT_IMG__/g)];
      for (const m of imgMatches) {
        if (m[1]) {
          blocks.push({ type: 'image', imageSrc: m[1] });
        }
      }
      const textWithoutImg = trimmed.replace(/__CBT_EXTRACTED_IMG__(.*?)__END_CBT_IMG__/g, '').trim();
      if (textWithoutImg) {
        blocks.push({ type: 'text', text: textWithoutImg });
      }
    } else {
      blocks.push({ type: 'text', text: trimmed });
    }
  }

  if (blocks.length === 0) {
    const stripped = html.replace(/<[^>]+>/g, '\n');
    return parseText(stripped);
  }

  return processBlocksIntoQuestions(blocks);
}

export function parseText(rawText: string): Question[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const blocks: BlockItem[] = lines.map((line) => ({ type: 'text', text: line }));
  return processBlocksIntoQuestions(blocks);
}

/**
 * Normalizes erratic lines (e.g. splitting question stems from inline options,
 * ungluing answer from next question, normalizing roman numerals)
 */
function normalizeBlocks(blocks: BlockItem[]): BlockItem[] {
  const expanded: BlockItem[] = [];

  for (const block of blocks) {
    if (block.type === 'image' || !block.text) {
      expanded.push(block);
      continue;
    }

    let line = block.text.trim();

    // 1. Check if line has Roman numeral options: (i) ... (ii) ...
    line = convertRomanOptionsToAlpha(line);

    // 2. Check if Answer is glued to next Question: "ANSWER: B 2. What is..."
    const gluedMatch = line.match(GLUED_ANS_NEXT_Q_REGEX);
    if (gluedMatch) {
      expanded.push({ type: 'text', text: `ANSWER: ${gluedMatch[2].toUpperCase()}` });
      expanded.push({ type: 'text', text: gluedMatch[3].trim() });
      continue;
    }

    // 3. Check if Question Number and inline options are on the same line:
    // e.g. "1. What is the capital of Nigeria? A) Lagos B) Abuja C) Ibadan D) Kano Ans: B"
    const inlineMatches = [...line.matchAll(INLINE_OPTIONS_REGEX)];
    if (inlineMatches.length >= 2) {
      const firstOptIndex = inlineMatches[0].index;
      const stemPart = line.substring(0, firstOptIndex).trim();
      let optionsPart = line.substring(firstOptIndex).trim();

      // Check for trailing answer at the end of optionsPart: e.g. "Ans: B"
      let trailingAns: string | null = null;
      const trailMatch = optionsPart.match(TRAILING_ANSWER_REGEX);
      if (trailMatch) {
        trailingAns = trailMatch[1].toUpperCase();
        optionsPart = optionsPart.replace(TRAILING_ANSWER_REGEX, '').trim();
      }

      if (stemPart) {
        expanded.push({ type: 'text', text: stemPart });
      }
      if (optionsPart) {
        expanded.push({ type: 'text', text: optionsPart });
      }
      if (trailingAns) {
        expanded.push({ type: 'text', text: `ANSWER: ${trailingAns}` });
      }
      continue;
    }

    // 4. Check if trailing answer is at the end of a single line of options
    const singleTrailMatch = line.match(TRAILING_ANSWER_REGEX);
    if (singleTrailMatch && (OPTION_START_REGEX.test(line) || INLINE_OPTIONS_REGEX.test(line))) {
      const ansLetter = singleTrailMatch[1].toUpperCase();
      const cleanLine = line.replace(TRAILING_ANSWER_REGEX, '').trim();
      expanded.push({ type: 'text', text: cleanLine });
      expanded.push({ type: 'text', text: `ANSWER: ${ansLetter}` });
      continue;
    }

    expanded.push({ type: 'text', text: line });
  }

  return expanded;
}

function convertRomanOptionsToAlpha(line: string): string {
  // Convert (i), (ii), (iii), (iv) to A), B), C), D)
  return line.replace(INLINE_ROMAN_REGEX, (match, g1, g2, g3) => {
    const roman = (g1 || g2 || g3 || '').toLowerCase();
    const alpha = ROMAN_MAP[roman];
    if (alpha) {
      return ` ${alpha}) `;
    }
    return match;
  });
}

/**
 * Scans for bottom answer keys placed underneath questions, such as:
 * - "1. a 2. C 3. D 4. E 5. A"
 * - "1. A, 2. B, 3. C, 4. D"
 * - "ANSWERS: 1. A 2. B 3. C"
 * - "MARKING SCHEME: 1. A \n 2. B \n 3. C"
 * - Table rows with answers: "1 | A | 2 | B"
 * Excludes these answer lines from being misidentified as question stems.
 */
function extractBottomAnswerKeys(blocks: BlockItem[]): {
  bottomKeys: { [key: number]: string };
  keptBlocks: BlockItem[];
} {
  const bottomKeys: { [key: number]: string } = {};
  const keptBlocks: BlockItem[] = [];
  let inSection = false;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type !== 'text' || !block.text) {
      keptBlocks.push(block);
      continue;
    }

    const line = block.text.trim();

    // Do not confuse standard single-question answer tags (e.g. "ANSWER: B") with bottom key sections
    if (ANSWER_REGEX.test(line)) {
      keptBlocks.push(block);
      continue;
    }

    // 1. Check for explicit bottom section header (e.g. "ANSWERS:", "MARKING SCHEME", "ANSWER KEY")
    const headerMatch = line.match(BOTTOM_SECTION_HEADER_REGEX);
    if (headerMatch) {
      inSection = true;
      const remainder = headerMatch[1].trim();
      if (remainder) {
        const matches = [...remainder.matchAll(BOTTOM_KEY_ITEM_REGEX)];
        for (const m of matches) {
          bottomKeys[parseInt(m[1], 10)] = m[2].toUpperCase();
        }
      }
      continue; // Omit header from question stems
    }

    if (inSection) {
      // 2A. Key items within explicit answer section
      const matches = [...line.matchAll(BOTTOM_KEY_ITEM_REGEX)];
      if (matches.length > 0) {
        for (const m of matches) {
          bottomKeys[parseInt(m[1], 10)] = m[2].toUpperCase();
        }
        continue;
      }

      // 2B. Single key line: "1. A" or "1 - B"
      const singleMatch = line.match(SINGLE_KEY_LINE_REGEX);
      if (singleMatch) {
        bottomKeys[parseInt(singleMatch[1], 10)] = singleMatch[2].toUpperCase();
        continue;
      }

      // 2C. Comma/space-separated list of letters: "A, B, C, D, A"
      const pureLetters = line.split(/[\s,;|]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (pureLetters.length >= 2 && pureLetters.every((s) => /^[A-E]$/.test(s))) {
        const startNum = Object.keys(bottomKeys).length + 1;
        pureLetters.forEach((letter, idx) => {
          bottomKeys[startNum + idx] = letter;
        });
        continue;
      }
    } else {
      // 3. No header written, but line contains 2 or more answer pairs:
      // e.g. "1. a 2. C 3. D 4. E 5. A" or "1. A, 2. C, 3. D"
      const matches = [...line.matchAll(BOTTOM_KEY_ITEM_REGEX)];
      if (matches.length >= 2) {
        for (const m of matches) {
          bottomKeys[parseInt(m[1], 10)] = m[2].toUpperCase();
        }
        continue; // Omit from question stems
      }

      // 4. Standalone single key line: e.g. "1. A" or "1. (c) =" or "2. (a) A single page/tab..."
      const singleMatch = line.match(SINGLE_KEY_LINE_REGEX);
      if (singleMatch) {
        const hasParentheses = /\([A-Ea-e]\)|\[[A-Ea-e]\]/.test(line);
        let hasSisterKeys = false;
        for (let j = i + 1; j < Math.min(i + 5, blocks.length); j++) {
          const nextText = blocks[j].text?.trim() || '';
          if (SINGLE_KEY_LINE_REGEX.test(nextText)) {
            hasSisterKeys = true;
            break;
          }
        }
        if (hasParentheses || hasSisterKeys || Object.keys(bottomKeys).length > 0) {
          bottomKeys[parseInt(singleMatch[1], 10)] = singleMatch[2].toUpperCase();
          continue;
        }
      }
    }

    keptBlocks.push(block);
  }

  return { bottomKeys, keptBlocks };
}

function processBlocksIntoQuestions(rawBlocks: BlockItem[]): Question[] {
  // 1. Pre-scan and extract bottom answer keys / marking schemes
  const { bottomKeys, keptBlocks: cleanRawBlocks } = extractBottomAnswerKeys(rawBlocks);

  // 2. Normalize question stems, glued answers, and options
  const keptBlocks = normalizeBlocks(cleanRawBlocks);
  const questions: Question[] = [];

  let currentQ: Question | null = null;
  let currentOptionLetter: string | null = null;
  let pendingImage: string | null = null;

  for (let i = 0; i < keptBlocks.length; i++) {
    const item = keptBlocks[i];

    // Handle Image Block (Auto-extracted from Word document)
    if (item.type === 'image' && item.imageSrc) {
      if (currentQ && !currentQ.image && !currentOptionLetter) {
        // Image appears directly under or alongside the current question stem
        currentQ.image = item.imageSrc;
      } else if (currentQ && !currentQ.image) {
        // Image belongs to current question
        currentQ.image = item.imageSrc;
      } else {
        // Image appears before upcoming question stem
        pendingImage = item.imageSrc;
      }
      continue;
    }

    // Handle Text Block
    const text = item.text || '';

    // 1. Check for single question answer
    const ansMatch = text.match(ANSWER_REGEX);
    if (ansMatch) {
      const ansLetter = ansMatch[1].toUpperCase();
      if (currentQ) {
        currentQ.answer = ansLetter;
      }
      continue;
    }

    // 2. Check for new Question start (explicit number: 1., 1), Q1, etc.)
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
        image: pendingImage || undefined,
        warnings: [],
        rawLines: [text],
      };
      pendingImage = null;
      currentOptionLetter = null;
      continue;
    }

    // 3. Check for UNNUMBERED question (e.g. paragraph followed immediately by Option A)
    // If text does NOT start with an option or answer, but the next item starts with Option A
    const nextItem = keptBlocks[i + 1];
    const isFollowedByOptionA =
      nextItem &&
      nextItem.type === 'text' &&
      nextItem.text &&
      (OPTION_START_REGEX.test(nextItem.text) || INLINE_OPTIONS_REGEX.test(nextItem.text));

    if (!OPTION_START_REGEX.test(text) && !ANSWER_REGEX.test(text) && isFollowedByOptionA) {
      if (currentQ) {
        finalizeQuestion(currentQ, bottomKeys);
        questions.push(currentQ);
      }

      currentQ = {
        id: questions.length + 1,
        number: questions.length + 1,
        stem: text.trim(),
        options: {},
        answer: null,
        image: pendingImage || undefined,
        warnings: [],
        rawLines: [text],
      };
      pendingImage = null;
      currentOptionLetter = null;
      continue;
    }

    // 4. Check for Option line (A-E)
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

    // 5. Check inline option without leading match
    const inlineOpts = splitInlineOptions(text);
    if (inlineOpts.length >= 2 && currentQ) {
      for (const [inLetter, inVal] of inlineOpts) {
        currentQ.options[inLetter] = inVal;
      }
      currentOptionLetter = inlineOpts[inlineOpts.length - 1][0];
      currentQ.rawLines?.push(text);
      continue;
    }

    // 6. Continuation line (multi-line question stem, table rows, or multi-line option)
    if (currentQ) {
      if (currentOptionLetter && currentQ.options[currentOptionLetter]) {
        currentQ.options[currentOptionLetter] += ' ' + text;
      } else {
        if (text.includes('|') || currentQ.stem.includes('|')) {
          currentQ.stem = currentQ.stem ? currentQ.stem + '\n' + text : text;
        } else {
          currentQ.stem = currentQ.stem ? currentQ.stem + ' ' + text : text;
        }
      }
      currentQ.rawLines?.push(text);
    }
  }

  // Finalize last question
  if (currentQ) {
    finalizeQuestion(currentQ, bottomKeys);
    questions.push(currentQ);
  }

  // Continuity check and fallback index-based answer assignment
  questions.forEach((q, idx) => {
    const expected = idx + 1;
    if (q.number !== expected) {
      q.warnings.push(`Numbering mismatch: Expected #${expected}, found #${q.number}`);
    }

    if (!q.answer) {
      if (bottomKeys[q.number]) {
        q.answer = bottomKeys[q.number];
      } else if (bottomKeys[expected]) {
        q.answer = bottomKeys[expected];
      }
      if (q.answer) {
        q.warnings = q.warnings.filter((w) => !w.includes('Missing correct answer'));
        if (!q.options[q.answer]) {
          q.warnings.push(`Marked answer "${q.answer}" does not match any detected options`);
        }
      }
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
  if (!q.answer) {
    if (bottomKeys[q.number]) {
      q.answer = bottomKeys[q.number];
    } else if (bottomKeys[q.id]) {
      q.answer = bottomKeys[q.id];
    }
  }

  const warnings: string[] = [];
  if (!q.answer) {
    warnings.push('Missing correct answer (no ANSWER: tag or marked option found)');
  } else if (!q.options[q.answer]) {
    warnings.push(`Marked answer "${q.answer}" does not match any detected options`);
  }

  const optCount = Object.keys(q.options).length;
  // Support Yoruba exam standard: A, B, D, E (since "C" does not exist in the Yoruba alphabet)
  const isYorubaScheme = !q.options['C'] && (q.options['D'] || q.options['E']);
  const expectedLetters = isYorubaScheme ? ['A', 'B', 'D', 'E'] : ['A', 'B', 'C', 'D'];

  if (optCount < 4) {
    const missing = expectedLetters.filter((l) => !q.options[l]);
    warnings.push(`Incomplete options (${optCount}/4 detected). Missing: ${missing.join(', ')}`);
  }

  q.warnings = warnings;
}
