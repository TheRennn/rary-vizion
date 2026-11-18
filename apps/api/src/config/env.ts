export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];

  if (typeof config.DATABASE_URL !== 'string' || config.DATABASE_URL.length === 0) {
    errors.push('DATABASE_URL é obrigatório');
  }
  if (typeof config.JWT_SECRET !== 'string' || config.JWT_SECRET.length < 16) {
    errors.push('JWT_SECRET é obrigatório e precisa ter ao menos 16 caracteres');
  }
  if (errors.length > 0) {
    throw new Error(`Configuração inválida:\n- ${errors.join('\n- ')}`);
  }
  return config;
}
