import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Create a .env file in the project root, add both variables from the Supabase dashboard (Settings → API), then restart npm run dev.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
