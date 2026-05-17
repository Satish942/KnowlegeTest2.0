import * as fs from 'fs';

let code = fs.readFileSync('src/utils/parser.ts', 'utf-8');
code = code.replace(/import.*pdfjs-dist.*/g, '').replace(/import.*mammoth.*/g, '').replace(/export /g, '');

const testScript = code + `
const text = \`
1. What is the capital of France?
A. London
B. Berlin
C. Paris
D. Madrid
Answer: C

2. Which are primary colors?
A. Red
B. Green
C. Blue
D. Yellow
Answer: AC

3. Select the correct options.
A: One
B: Two
C: Three
Answer: ABC
\`;

const config = {
  questionMarker: 'n.',
  optionMarker: 'A.',
  answerStartMarker: 'Answer:',
  explanationMarker: 'Explanation:',
  referenceUrlMarker: 'Reference:',
  pickReferenceUrl: false,
  haveChapters: false,
  extractImages: false
};

console.log(JSON.stringify(parseExamText(text, config), null, 2));
`;

fs.writeFileSync('test_runner.ts', testScript);
