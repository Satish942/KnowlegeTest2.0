function escapeRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapedDelim(d) {
  return d === ')' ? '\\)' : d === '.' ? '\\.' : d;
}

function buildQuestionRegex(marker) {
  const m = marker.trim();
  if (!m) {
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
  
  const ep = escapeRx(m).replace(/ /g, '\\s*');
  return {
    regex: new RegExp(`^\\s*${ep}\\s*(\\d+)[\\)\\.:]?\\s*`, 'gim'),
    stripRegex: new RegExp(`^\\s*${ep}\\s*\\d+[\\)\\.:]?\\s*`, 'i'),
  };
}

function buildOptionRegex(marker) {
  const m = marker.trim();
  if (!m) {
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
    const matchStr = m.match(/\b([A-Z])\b/)[0];
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
  const ep = escapeRx(m).replace(/ /g, '\\s*');
  return {
    regex: new RegExp(`^\\s*${ep}\\s*([A-Z])[\\)\\.:]?\\s*`, 'gim'),
    stripRegex: new RegExp(`^\\s*${ep}\\s*[A-Z][\\)\\.:]?\\s*`, 'i'),
  };
}

function stripTrailingPunct(s) {
  return s.replace(/[:\-\s]+$/, '').trim();
}

function parseExamText(text, config) {
  const questions = [];
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const { regex: questionRegex, stripRegex: qStripRegex } = buildQuestionRegex(config.questionMarker);
  const { regex: optRegex, stripRegex: optStripRegex } = buildOptionRegex(config.optionMarker);

  const cleanAns  = stripTrailingPunct(config.answerStartMarker);
  const escapedAns = escapeRx(cleanAns);
  
  const markers = [];
  let markerMatch;
  questionRegex.lastIndex = 0;
  while ((markerMatch = questionRegex.exec(cleanText)) !== null) {
    const qNumStr = markerMatch[1] || markerMatch[2];
    if (!qNumStr) continue;
    const qNum = parseInt(qNumStr);
    markers.push({ index: markerMatch.index, qNum });
  }

  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end   = markers[i + 1] ? markers[i + 1].index : cleanText.length;
    const qNum  = markers[i].qNum;
    const block = cleanText.substring(start, end).trim();

    const options = {};
    const optMarkers = [];
    optRegex.lastIndex = 0;
    let optM;
    while ((optM = optRegex.exec(block)) !== null) {
      optMarkers.push({ index: optM.index, key: optM[1].toUpperCase() });
    }

    for (let j = 0; j < optMarkers.length; j++) {
      const oStart = optMarkers[j].index;
      const oEnd   = optMarkers[j + 1] ? optMarkers[j + 1].index : block.length;
      const raw    = block.substring(oStart, oEnd);
      let oContent = raw.replace(optStripRegex, '').trim();
      options[optMarkers[j].key] = oContent;
    }

    const correctAnswers = [];
    if (cleanAns) {
      const ansRx  = new RegExp(`${escapedAns}[:\\s]+([A-Z0-9,\\s;&/]+)`, 'i');
      const ansHit = block.match(ansRx);
      if (ansHit) {
        const line = ansHit[1].split('\n')[0].trim();
        const letters = (line.match(/\b[A-Z]\b/gi) || []).map(a => a.toUpperCase());
        if (letters.length) correctAnswers.push(...new Set(letters));
      }
    }

    const firstOptIdx = optMarkers.length > 0 ? optMarkers[0].index : block.length;
    let questionText  = block.substring(0, firstOptIdx).replace(qStripRegex, '').trim();

    if (questionText && correctAnswers.length > 0) {
      questions.push({
        question_text: questionText,
        options,
        correct_answers: correctAnswers
      });
    } else {
        console.log(`Failed to push question ${qNum}. qt: "${questionText}", ans:`, correctAnswers);
    }
  }

  return questions;
}

const config = {
  questionMarker: "Question: n",
  optionMarker: "Option: A",
  answerStartMarker: "Answer:",
};

const text = `
Question: 1
What is the capital of France?
Option: A) London
Option: B) Paris
Option: C) Rome
Option: D) Berlin
Answer: B
Explanation: Paris is the capital.

Question: 2
What is 2+2?
Option: A) 3
Option: B) 4
Option: C) 5
Option: D) 6
Answer: B
Explanation: basic math

Question: 3
Is it true?
Option: A) Yes
Option: B) No
Answer: A

Question: 4
Q4 text
Option: A) A
Option: B) B
Answer: B

Question: 5
Last question
Option: A) A
Option: B) B
Answer: A
`;

const res = parseExamText(text, config);
console.log("Result length: " + res.length);
