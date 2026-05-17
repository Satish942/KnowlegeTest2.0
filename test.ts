import { parseExamText, ParserConfig } from './src/utils/parser.ts';

const text = `
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
`;

const config: ParserConfig = {
  questionMarker: 'n.',
  optionMarker: 'A.',
  answerStartMarker: 'Answer:',
  explanationMarker: 'Explanation:',
  referenceUrlMarker: 'Reference:',
  pickReferenceUrl: false,
  haveChapters: false,
  extractImages: false
};

const result = parseExamText(text, config);
console.log(JSON.stringify(result, null, 2));
