import { parseExamText, ParserConfig } from './src/utils/parser.ts';

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
`;

const config: ParserConfig = {
  questionMarker: 'Question: n',
  optionMarker: 'Option: A',
  answerStartMarker: 'Answer:',
  explanationMarker: 'Explanation:',
  referenceUrlMarker: 'Reference:',
  pickReferenceUrl: false,
  haveChapters: false,
  extractImages: false
};

const questions = parseExamText(text, config);
console.log(JSON.stringify(questions, null, 2));
