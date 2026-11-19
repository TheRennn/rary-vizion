export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const isProduction = config.NODE_ENV === 'production';

  const url = config.SUPABASE_URL;
  const supabaseKeys = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'];
  const configuredSupabaseKeys = supabaseKeys.filter((key) => {
    const value = config[key];
    return typeof value === 'string' && value.length > 0 && !value.includes('SEU-PROJETO') && !value.includes('_...');
  });
  if (configuredSupabaseKeys.length > 0 && configuredSupabaseKeys.length !== supabaseKeys.length) {
    errors.push('Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY em conjunto');
  }
  if (typeof url === 'string' && url.length > 0 && !url.includes('SEU-PROJETO')) {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new Error();
    } catch {
      errors.push('SUPABASE_URL deve ser uma URL válida');
    }
  }

  const jwtSecret = config.JWT_SECRET;
  if (isProduction && (typeof jwtSecret !== 'string' || jwtSecret.length < 32 || jwtSecret.startsWith('development-only'))) {
    errors.push('JWT_SECRET deve ter pelo menos 32 caracteres e não pode ser a chave de desenvolvimento em produção');
  }

  const port = config.PORT;
  if (port !== undefined && (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535)) {
    errors.push('PORT deve ser um número entre 1 e 65535');
  }

  const cors = config.CORS_ORIGIN;
  if (typeof cors === 'string' && cors.trim()) {
    for (const origin of cors.split(',').map((value) => value.trim())) {
      try {
        const parsed = new URL(origin);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || (isProduction && origin === '*')) throw new Error();
      } catch {
        errors.push('CORS_ORIGIN deve conter origens válidas separadas por vírgula');
        break;
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`Configuração inválida:\n- ${errors.join('\n- ')}`);
  }
  return config;
}
