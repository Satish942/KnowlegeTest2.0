function escapedDelim(d) {
  return d === ')' ? '\\)' : d === '.' ? '\\.' : d;
}
function escapeRx(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    
    const escapedPrefix = prefix ? escapeRx(prefix).replace(/\\ /g, '\\s*') : '';
    
    const dMatch = suffix.match(/^([:\)\.])/);
    const ed = dMatch ? escapedDelim(dMatch[1]) : '[:\\)\\.]?';
    
    return {
      regex: new RegExp(`^\\s*${escapedPrefix}(\\d+)${ed}\\s*`, 'gim'),
      stripRegex: new RegExp(`^\\s*${escapedPrefix}\\d+${ed}\\s*`, 'i'),
    };
  }
  
  // String prefix like "Q"
  const ep = escapeRx(m).replace(/\\ /g, '\\s*');
  return {
    regex: new RegExp(`^\\s*${ep}\\s*(\\d+)[\\)\\.:]?\\s*`, 'gim'),
    stripRegex: new RegExp(`^\\s*${ep}\\s*\\d+[\\)\\.:]?\\s*`, 'i'),
  };
}

const res = buildQuestionRegex("Question: n");
console.log(res);

const text = "Question: 1\nWhat is your name?\nAnswer: A";
console.log("Regex lastIndex before:", res.regex.lastIndex);
let match;
while ((match = res.regex.exec(text)) !== null) {
  console.log("Match found!", match);
}

