export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];

  const url = config.SUPABASE_URL;
  if (typeof url === 'string' &&
      url.length > 0 &&
      url !== 'https://SEU-PROJETO.supabase.co' &&
      !/^https?:\/\//.test(url)) {
    errors.push('SUPABASE_URL deve ser uma URL válida');
  }
  if (errors.length > 0) {
    throw new Error(`Configuração inválida:\n- ${errors.join('\n- ')}`);
  }
  return config;
}
