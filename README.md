# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

-------
-- Run this in your Supabase SQL Editor

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Questions table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_answers TEXT[] NOT NULL,
    is_multi BOOLEAN DEFAULT FALSE,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Exam History table
CREATE TABLE IF NOT EXISTS public.exam_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_name TEXT NOT NULL,
    score FLOAT NOT NULL,
    total_questions INTEGER NOT NULL,
    user_responses JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable RLS (Optional, but good practice. For now, we'll keep it simple or allow all access if no Auth is set)
-- For the sake of this demo, we'll just disable RLS or create a policy that allows everything.
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous ALL" ON public.documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous ALL" ON public.questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous ALL" ON public.exam_history FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS max_selections INTEGER DEFAULT 1;

ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS is_explicit_limit BOOLEAN DEFAULT FALSE;

ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS chapter TEXT DEFAULT 'Default';

ALTER TABLE public.exam_history 
ADD COLUMN IF NOT EXISTS attempted_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wrong_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS questions_snapshot JSONB DEFAULT '[]'::jsonb;

-- 6. Parser Presets table
CREATE TABLE IF NOT EXISTS public.parser_presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_marker TEXT,
    option_marker TEXT,
    answer_marker TEXT,
    explanation_marker TEXT,
    reference_marker TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS and add policy
ALTER TABLE public.parser_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous ALL" ON public.parser_presets FOR ALL USING (true) WITH CHECK (true);

===
npm run build
npm run dev





