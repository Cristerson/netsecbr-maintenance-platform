import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const environments = {
  staging: 'https://zhsutxrvjocamdyyrquy.supabase.co',
  production: 'https://zhsutxrvjocamdyyrquy.supabase.co',
} as const;

export default defineConfig(({ mode }) => {
  if (mode !== 'staging' && mode !== 'production') {
    throw new Error('Use apenas os modos "staging" ou "production" para o MARV.');
  }

  const env = loadEnv(mode, process.cwd(), '');
  const configuredUrl = env.VITE_SUPABASE_URL?.replace(/\/$/, '');

  if (configuredUrl !== environments[mode]) {
    throw new Error(
      `Ambiente ${mode} bloqueado: VITE_SUPABASE_URL deve apontar para ${environments[mode]}.`,
    );
  }

  if (!env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(`Ambiente ${mode} bloqueado: VITE_SUPABASE_PUBLISHABLE_KEY não foi configurada.`);
  }

  return {
    plugins: [react()],
    build: {
      outDir: `dist/${mode}`,
      emptyOutDir: true,
    },
  };
});
