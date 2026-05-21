import { parseExamText, ParserConfig } from './src/utils/parser.ts';

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
console.log('Result length:', res.length);
if (res.length < 5) console.log('Missing question!', JSON.stringify(res, null, 2));
