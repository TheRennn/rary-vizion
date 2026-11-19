export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];

  if (typeof config.SUPABASE_URL !== 'string' || !/^https?:\/\//.test(config.SUPABASE_URL)) {
    errors.push('SUPABASE_URL é obrigatório');
  }
  if (typeof config.SUPABASE_PUBLISHABLE_KEY !== 'string' || config.SUPABASE_PUBLISHABLE_KEY.length === 0) {
    errors.push('SUPABASE_PUBLISHABLE_KEY é obrigatório');
  }
  if (typeof config.SUPABASE_SECRET_KEY !== 'string' || config.SUPABASE_SECRET_KEY.length === 0) {
    errors.push('SUPABASE_SECRET_KEY é obrigatório');
  }
  if (errors.length > 0) {
    throw new Error(`Configuração inválida:\n- ${errors.join('\n- ')}`);
  }
  return config;
}
