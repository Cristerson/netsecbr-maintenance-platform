import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error('A conexão com o Supabase não foi configurada. Verifique o arquivo .env.local.');
}

export const supabase = createClient(url, publishableKey);
