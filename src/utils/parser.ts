import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export interface ParsedQuestion {
  question_text: string;
  options: Record<string, string>;
  correct_answers: string[];
  is_multi: boolean;
  max_selections?: number;
  is_explicit_limit?: boolean;
  explanation?: string;
  chapter?: string;
}

export interface ParserConfig {
  questionMarker: string;
  optionMarker: string;
  answerStartMarker: string;
  explanationMarker: string;
  referenceUrlMarker: string;
  pickReferenceUrl: boolean;
  haveChapters: boolean;
  extractImages?: boolean;
}

/** Convert raw RGBA image data + dimensions to a PNG data-URL via an offscreen canvas. */
function rgbaToDataUrl(data: Uint8ClampedArray | Uint8Array, width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const imgData = ctx.createImageData(width, height);
  imgData.data.set(data);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

export async function extractTextFromPDF(
  file: File, 
  config?: ParserConfig,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  // Ensure worker is absolutely set
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
  }

  const pdf = await pdfjs.getDocument({ 
    data: arrayBuffer,
    stopAtErrors: false,
  }).promise;
  
  let fullText = '';
  const numPages = pdf.numPages;

  for (let i = 1; i <= numPages; i++) {
    if (onProgress) onProgress(i, numPages);
    
    const page = await pdf.getPage(i);

    // ── Text extraction ───────────────────────────────────────────────────────
    const content = await page.getTextContent();
    let lastY: number | undefined;
    let text = '';
    const items = [...content.items].sort((a, b) => {
      const aT = (a as { transform: number[] }).transform;
      const bT = (b as { transform: number[] }).transform;
      if (!aT || !bT) return 0;
      // Sorting by Y (descending) then X (ascending) for natural reading order
      if (Math.abs(bT[5] - aT[5]) > 2) return bT[5] - aT[5];
      return aT[4] - bT[4];
    });

    for (const item of items) {
      const it = item as { str: string; transform: number[] };
      if (lastY !== undefined && Math.abs(lastY - it.transform[5]) > 3) text += '\n';
      else if (text !== '') text += ' ';
      text += it.str;
      lastY = it.transform[5];
    }

    // ── Image extraction ──────────────────────────────────────────────────────
    // Only extract images if explicitly requested 
    if (config?.extractImages) {
      try {
        const extractImages = async () => {
          const ops = await page.getOperatorList();
          const imgNames: string[] = [];
          for (let j = 0; j < ops.fnArray.length; j++) {
            if (ops.fnArray[j] === pdfjs.OPS.paintImageXObject) {
              const name = ops.argsArray[j][0];
              if (name && !imgNames.includes(name)) imgNames.push(name);
            }
          }
          
          // Cap images per page to prevent memory blowup
          for (const name of imgNames.slice(0, 10)) {
            try {
              const imgObj = await Promise.race([
                new Promise(resolve => page.objs.get(name, resolve)),
                new Promise(resolve => setTimeout(() => resolve(null), 2000)),
              ]) as { data: Uint8ClampedArray, width: number, height: number } | null;
              if (imgObj?.data && imgObj.width && imgObj.height) {
                const dataUrl = rgbaToDataUrl(imgObj.data, imgObj.width, imgObj.height);
                if (dataUrl) text += `\n[[IMG:${dataUrl}]]\n`;
              }
            } catch { /* skip */ }
          }
        };
        
        await Promise.race([
          extractImages(),
          new Promise<void>(resolve => setTimeout(resolve, 5000)),
        ]);
      } catch { /* skip */ }
    }

    fullText += text + '\n\n';
  }
  return fullText;
}

function htmlToMarkedText(html: string): string {
  return html
    .replace(/<img[^>]+src="([^"]+)"[^>]*\/?>/gi, (_: string, src: string) => `\n[[IMG:${src}]]\n`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromDocx(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  if (onProgress) onProgress(1, 2); // DOCX is usually one-shot

  try {
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer }, {
      convertImage: mammoth.images.imgElement(async (image) => {
        const b64 = await image.read('base64');
        return {
          src: `data:${image.contentType};base64,${b64}`,
          style: 'max-width:100%;height:auto;'
        };
      })
    });
    if (onProgress) onProgress(2, 2);
    return htmlToMarkedText(htmlResult.value);
  } catch {
    const textResult = await mammoth.extractRawText({ arrayBuffer });
    if (onProgress) onProgress(2, 2);
    return textResult.value;
  }
}

// ─── Pattern helpers ──────────────────────────────────────────────────────────


function escapeRx(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapedDelim(d: string) {
  return d === ')' ? '\\)' : d === '.' ? '\\.' : d;
}

/**
 * Build question-detection regex from the Question String field.
 * Uses multiline ^ so it matches the start of ANY line — much more reliable
 * than the old (?:\n|^|\s{2,}) prefix.
 *
 *  "Question: n"                       → prefix + number       → Question: 1
 *  "n. Question" / "n." / "n)" / "n:"  → numeric placeholder   → 1.  2.  3. …
 *  "Q" / any other string              → string prefix         → Q1. Q 2. …
 *  ""                                  → bare-number fallback  → 1.  2.  3. …
 */
function buildQuestionRegex(marker: string): { regex: RegExp; stripRegex: RegExp } {
  const m = marker.trim();
  if (!m) {
    // No marker: match "1." / "2." at the start of any line (optional leading spaces)
    return {
      regex: /^\s*(\d+)\.\s*/gim,
      stripRegex: /^\s*\d+\.\s*/,
    };
  }

  if (/\bn\b/.test(m)) {
    const parts = m.split(/\bn\b/);
    const prefix = parts[0];
    const suffix = parts.slice(1).join('n');
    
    const escapedPrefix = prefix ? escapeRx(prefix).replace(/ /g, '\\s*') : '';
    
    const dMatch = suffix.match(/^([:\)\.])/);
    const ed = dMatch ? escapedDelim(dMatch[1]) : '[:\\)\\.]?';
    
    return {
      regex: new RegExp(`^\\s*${escapedPrefix}(\\d+)${ed}\\s*`, 'gim'),
      stripRegex: new RegExp(`^\\s*${escapedPrefix}\\d+${ed}\\s*`, 'i'),
    };
  }
  
  // String prefix like "Q"
  const ep = escapeRx(m).replace(/ /g, '\\s*');
  return {
    regex: new RegExp(`^\\s*${ep}\\s*(\\d+)[\\)\\.:]?\\s*`, 'gim'),
    stripRegex: new RegExp(`^\\s*${ep}\\s*\\d+[\\)\\.:]?\\s*`, 'i'),
  };
}

/**
 * Build option-detection regex from the Option String Starts field.
 * Also uses multiline ^ so only actual line-start options are matched.
 *
 *  "Option: A"         → prefix + alpha   → Option: A
 *  "n:" / "n." / "n)"  → numeric options  → 1:  2:  3: …
 *  "A:" / "A." / "A)"  → alpha options    → A:  B:  C: …
 *  ""                  → default A–F with ) or .
 */
function buildOptionRegex(marker: string): { regex: RegExp; stripRegex: RegExp } {
  const m = marker.trim();
  if (!m) {
    // Default: A–F followed by ) or .
    return {
      regex: /^\s*([A-F])[).]\s*/gim,
      stripRegex: /^\s*[A-F][).]\s*/,
    };
  }

  if (/\bn\b/.test(m)) {
    const parts = m.split(/\bn\b/);
    const prefix = parts[0];
    const suffix = parts.slice(1).join('n');
    const escapedPrefix = prefix ? escapeRx(prefix).replace(/ /g, '\\s*') : '';
    
    const dMatch = suffix.match(/^([:\)\.])/);
    const ed = dMatch ? escapedDelim(dMatch[1]) : '[:\\)\\.]?';
    
    return {
      regex: new RegExp(`^\\s*${escapedPrefix}(\\d+)${ed}\\s*`, 'gim'),
      stripRegex: new RegExp(`^\\s*${escapedPrefix}\\d+${ed}\\s*`, 'i'),
    };
  }
  
  if (/\b[A-Z]\b/.test(m)) {
    const matchStr = m.match(/\b([A-Z])\b/)![0];
    const parts = m.split(new RegExp(`\\b${matchStr}\\b`));
    const prefix = parts[0];
    const suffix = parts.slice(1).join(matchStr);
    const escapedPrefix = prefix ? escapeRx(prefix).replace(/ /g, '\\s*') : '';
    
    const dMatch = suffix.match(/^([:\)\.])/);
    const ed = dMatch ? escapedDelim(dMatch[1]) : '[:\\)\\.]?';
    
    return {
      regex: new RegExp(`^\\s*${escapedPrefix}([A-Z])${ed}\\s*`, 'gim'),
      stripRegex: new RegExp(`^\\s*${escapedPrefix}[A-Z]${ed}\\s*`, 'i'),
    };
  }

  // Fallback if they just typed a prefix like "Option"
  const ep = escapeRx(m).replace(/ /g, '\\s*');
  return {
    regex: new RegExp(`^\\s*${ep}\\s*([A-Z])[\\)\\.:]?\\s*`, 'gim'),
    stripRegex: new RegExp(`^\\s*${ep}\\s*[A-Z][\\)\\.:]?\\s*`, 'i'),
  };
}

/**
 * Strip trailing ":" or "-" from a marker the user typed (e.g. "Explanation:")
 * so we can safely append our own delimiter pattern in the regex.
 */
function stripTrailingPunct(s: string) {
  return s.replace(/[:\-\s]+$/, '').trim();
}

/**
 * Detect "Choose N" or "Select N" signals in the question text.
 */
function detectMultiSignals(text: string): { isMulti: boolean; maxSelections: number; isExplicit: boolean } {
  const lower = text.toLowerCase();
  
  // Look for "Choose 2", "Select two", "Pick 3" etc.
  const numMap: Record<string, number> = { 
    'two': 2, 'three': 3, 'four': 4, 'five': 5, 
    '2': 2, '3': 3, '4': 4, '5': 5 
  };
  
  const multiMatch = lower.match(/(?:choose|select|pick|identify|mark)\s*(?:any|all\s*that\s*apply|(\w+))/i);
  
  if (multiMatch) {
    if (lower.includes('all that apply') || lower.includes('any')) {
      return { isMulti: true, maxSelections: 5, isExplicit: false };
    }
    const val = multiMatch[1]?.toLowerCase();
    if (val && numMap[val]) {
      return { isMulti: true, maxSelections: numMap[val], isExplicit: true };
    }
  }

  // Fallback for "Select (2)" or similar patterns
  const parenMatch = lower.match(/\((\d+)\)\s*(?:answers|choices|options|responses)/i);
  if (parenMatch) {
    return { isMulti: true, maxSelections: parseInt(parenMatch[1]), isExplicit: true };
  }

  return { isMulti: false, maxSelections: 1, isExplicit: false };
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseExamText(text: string, config: ParserConfig): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Build question + option patterns from user inputs
  const { regex: questionRegex, stripRegex: qStripRegex } = buildQuestionRegex(config.questionMarker);
  const { regex: optRegex, stripRegex: optStripRegex } = buildOptionRegex(config.optionMarker);

  // Strip trailing ":" from tag-style markers so the regex doesn't require a double colon
  const cleanAns  = stripTrailingPunct(config.answerStartMarker);
  const cleanExpl = stripTrailingPunct(config.explanationMarker);
  const cleanRef  = stripTrailingPunct(config.referenceUrlMarker);
  const escapedAns = escapeRx(cleanAns);
  const escapedE  = escapeRx(cleanExpl);
  const escapedR  = escapeRx(cleanRef);

  // ── Chapter Detection ────────────────────────────────────────────────────────
  const chapters: { name: string; startIndex: number }[] = [];
  if (config.haveChapters) {
    const chapterRegex = /(?:\n|^)\s*(?:Chapter|Section|Module)\s*(\d+|[A-Z]+|[\w\s]+?)(?:\n|:|$)/gi;
    let chMatch: RegExpExecArray | null;
    while ((chMatch = chapterRegex.exec(cleanText)) !== null) {
      chapters.push({ name: chMatch[0].trim(), startIndex: chMatch.index });
    }
  }

  // ── Global Answer Key (e.g. an "Answer Key" section at end of doc) ──────────
  const masterAnswerKey: Record<number, string[]> = {};
  // Build the section-header pattern from the user marker, or fall back to common keywords
  const ansKeyPattern = cleanAns
    ? `${escapedAns}[s]?\\s*Key|${escapedAns}[s]?\\s*Sheet`
    : `Answer[s]?\\s*Key|Correct\\s*Answer[s]?`;
  const answerKeySection = cleanText.match(new RegExp(`(?:${ansKeyPattern})([\\s\\S]*)$`, 'i'));
  if (answerKeySection) {
    const keyRegex = /(?:\n|^|\s)(\d+)\s*[:.]?\s*([A-F](?:[\s,&]+[A-F]*)*)/gi;
    let km: RegExpExecArray | null;
    while ((km = keyRegex.exec(answerKeySection[1])) !== null) {
      const qn = parseInt(km[1]);
      const raw = km[2].trim();
      const arr = raw.length <= 5 && /^[A-F]+$/i.test(raw)
        ? raw.split('').map(a => a.toUpperCase())
        : (raw.match(/\b[A-F]\b/gi) || []).map(a => a.toUpperCase());
      if (arr.length > 0) masterAnswerKey[qn] = [...new Set(arr)];
    }
  }

  // ── Find all question start positions ────────────────────────────────────────
  const markers: { index: number; qNum: number }[] = [];
  let markerMatch: RegExpExecArray | null;
  questionRegex.lastIndex = 0;
  while ((markerMatch = questionRegex.exec(cleanText)) !== null) {
    const qNumStr = markerMatch[1] || markerMatch[2];
    if (!qNumStr) continue;
    const qNum = parseInt(qNumStr);
    // Skip numbers that are part of decimals / fractions / version numbers
    const ctx = cleanText.substring(Math.max(0, markerMatch.index - 2), markerMatch.index + 12);
    if (/\d\.\d|\/\d|0\.0/.test(ctx)) continue;
    markers.push({ index: markerMatch.index, qNum });
  }

  // ── Process each question block ───────────────────────────────────────────────
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end   = markers[i + 1] ? markers[i + 1].index : cleanText.length;
    const qNum  = markers[i].qNum;
    const block = cleanText.substring(start, end).trim();

    // Chapter
    let currentChapter = 'Default';
    if (config.haveChapters && chapters.length > 0) {
      const ch = chapters.filter(c => c.startIndex <= start).pop();
      if (ch) currentChapter = ch.name;
    }

    // ── Options ────────────────────────────────────────────────────────────────
    const options: Record<string, string> = {};
    const optMarkers: { index: number; key: string }[] = [];
    optRegex.lastIndex = 0;
    let optM: RegExpExecArray | null;
    while ((optM = optRegex.exec(block)) !== null) {
      optMarkers.push({ index: optM.index, key: optM[1].toUpperCase() });
    }

    for (let j = 0; j < optMarkers.length; j++) {
      const oStart = optMarkers[j].index;
      const oEnd   = optMarkers[j + 1] ? optMarkers[j + 1].index : block.length;
      const raw    = block.substring(oStart, oEnd);
      // Strip the option label itself (e.g. "A:" or "1)")
      let oContent = raw.replace(optStripRegex, '').trim();
      // Cut off at user-defined answer marker if it bleeds in
      if (cleanAns) {
        const cut = oContent.match(new RegExp(`${escapedAns}[:\\s]`, 'i'));
        if (cut && cut.index !== undefined) oContent = oContent.substring(0, cut.index).trim();
      }
      // Also cut off common "Answer(s):" / "Correct Answer:" patterns regardless of config
      const ansBleed = oContent.match(/\b(?:Answers?|Correct(?:\s+Answer)?)\s*:/i);
      if (ansBleed && ansBleed.index !== undefined) oContent = oContent.substring(0, ansBleed.index).trim();
      // Cut off at explanation marker if it bleeds in
      if (cleanExpl) {
        const cut = oContent.match(new RegExp(`${escapedE}[:\\s]`, 'i'));
        if (cut && cut.index !== undefined) oContent = oContent.substring(0, cut.index).trim();
      }
      options[optMarkers[j].key] = oContent;
    }

    // ── Correct answer ────────────────────────────────────────────────────────
    // Use the user-defined answerStartMarker (e.g. "Answer:" or "Correct:").
    // After the marker, capture letter keys (A, B … Z) OR numeric keys (1, 2 … n).
    const correctAnswers: string[] = [];
    if (cleanAns) {
      const ansRx  = new RegExp(`${escapedAns}[:\\s]+([A-Z0-9,\\s;&/]+)`, 'i');
      const ansHit = block.match(ansRx);
      if (ansHit) {
        const line = ansHit[1].split('\n')[0].trim();
        // Prefer letter keys (A, B, C …)
        const letters = (line.match(/\b[A-Z]\b/gi) || []).map(a => a.toUpperCase());
        // Fall back to digit keys (1, 2, 3 …) when no letters found
        const digits  = (line.match(/\b\d+\b/g) || []);
        const arr = letters.length > 0 ? letters : digits;
        if (arr.length) correctAnswers.push(...new Set(arr));
      }
    }
    // Fall back to the global answer key section if nothing found inline
    if (correctAnswers.length === 0 && masterAnswerKey[qNum]) {
      correctAnswers.push(...masterAnswerKey[qNum]);
    }

    // ── Explanation ────────────────────────────────────────────────────────────
    let explanation = '';
    if (cleanExpl) {
      const exM = block.match(new RegExp(`${escapedE}[:\\-\\s]+([\\s\\S]*)$`, 'i'));
      if (exM) {
        explanation = exM[1].split(/\n\s*\d+\.|\n\s*Q\d+/)[0].trim();
      }
    }

    // ── Reference URL ──────────────────────────────────────────────────────────
    if (config.pickReferenceUrl && cleanRef) {
      const refRx  = new RegExp(`${escapedR}[:\\s]*(https?://[^\\s\\)]+)`, 'gi');
      const refHit = refRx.exec(block);
      if (refHit) {
        explanation = (explanation ? explanation + '\n\n' : '') + `Reference: ${refHit[1]}`;
      }
    }

    // ── Question text — strip question label from front ───────────────────────
    const firstOptIdx = optMarkers.length > 0 ? optMarkers[0].index : block.length;
    let questionText  = block.substring(0, firstOptIdx).replace(qStripRegex, '').trim();
    // Strip any redundant leading "QUESTION n" / "Question n" / "Q n" left after marker removal
    questionText = questionText.replace(/^(?:QUESTION|Question|Q)\s*\d*\s*[:.-]?\s*/i, '').trim();

    // Skip questions with no detected answer — don't fabricate True/False defaults
    if (questionText && correctAnswers.length > 0) {
      const signals = detectMultiSignals(questionText);
      const isMulti = correctAnswers.length > 1 || signals.isMulti;
      const maxSelections = signals.isExplicit ? signals.maxSelections : Math.max(correctAnswers.length, signals.maxSelections);

      questions.push({
        question_text: questionText,
        options,
        correct_answers: correctAnswers,
        is_multi: isMulti,
        max_selections: maxSelections,
        is_explicit_limit: signals.isExplicit,
        explanation,
        chapter: currentChapter,
      });
    }
  }

  return questions;
}
