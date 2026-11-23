export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const errors: string[] = [];
  const isProduction = config.NODE_ENV === 'production';

  const supabaseUrl = config.SUPABASE_URL;
  const supabaseLocal = config.SUPABASE_LOCAL === 'true';
  const supabaseEnvironment = config.SUPABASE_ENVIRONMENT;
  const expectedProjectRef = config.SUPABASE_PROJECT_REF;
  const supabasePublicKey = config.SUPABASE_PUBLISHABLE_KEY;
  const supabaseSecretKey = config.SUPABASE_SECRET_KEY;
  if (typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) errors.push('SUPABASE_URL é obrigatório');
  else {
    try {
      const parsed = new URL(supabaseUrl);
      const loopback = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsed.hostname);
      if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error();
      if (loopback) {
        if (isProduction || !supabaseLocal || parsed.protocol !== 'http:') throw new Error();
      } else if (!parsed.hostname.endsWith('.supabase.co') || supabaseLocal) throw new Error();
      if (supabaseEnvironment === 'development') {
        const projectRef = parsed.hostname.replace(/\.supabase\.co$/, '');
        if (typeof expectedProjectRef !== 'string' || !/^[a-z0-9]{20}$/.test(expectedProjectRef) || projectRef !== expectedProjectRef) throw new Error();
      }
    } catch { errors.push('SUPABASE_URL deve ser um projeto Supabase HTTPS ou loopback HTTP explicitamente habilitado em desenvolvimento'); }
  }
  if (supabaseLocal && isProduction) errors.push('SUPABASE_LOCAL não pode ser habilitado em produção');
  if (supabaseEnvironment === 'development' && isProduction) errors.push('SUPABASE_ENVIRONMENT=development não pode ser habilitado em produção');
  if (supabaseEnvironment !== undefined && !['development', 'production'].includes(String(supabaseEnvironment))) errors.push('SUPABASE_ENVIRONMENT deve ser development ou production');
  if (typeof supabasePublicKey !== 'string' || !supabasePublicKey.trim()) errors.push('SUPABASE_PUBLISHABLE_KEY é obrigatório');
  if (typeof supabaseSecretKey !== 'string' || !supabaseSecretKey.trim()) errors.push('SUPABASE_SECRET_KEY é obrigatório apenas no backend');

  const redisUrl = config.RATE_LIMIT_REDIS_URL;
  const redisToken = config.RATE_LIMIT_REDIS_TOKEN;
  const hasRedisUrl = typeof redisUrl === 'string' && redisUrl.trim().length > 0;
  const hasRedisToken = typeof redisToken === 'string' && redisToken.trim().length > 0;
  if (hasRedisToken && !hasRedisUrl) errors.push('RATE_LIMIT_REDIS_TOKEN requer RATE_LIMIT_REDIS_URL');
  if (isProduction && !hasRedisUrl) {
    errors.push('RATE_LIMIT_REDIS_URL com TLS é obrigatório em produção (HTTPS REST ou rediss)');
  }
  if (typeof redisUrl === 'string' && redisUrl.trim()) {
    try {
      const parsed = new URL(redisUrl);
      if (['https:', 'http:'].includes(parsed.protocol)) {
        if (!hasRedisToken) throw new Error('token');
        if (isProduction && parsed.protocol !== 'https:') throw new Error('tls');
      } else if (['redis:', 'rediss:'].includes(parsed.protocol)) {
        if (hasRedisToken || !parsed.password) throw new Error('credentials');
        if (isProduction && parsed.protocol !== 'rediss:') throw new Error('tls');
      } else {
        throw new Error('protocol');
      }
    } catch { errors.push('RATE_LIMIT_REDIS_URL deve ser HTTPS com token REST ou redis[s]:// com senha; produção exige TLS'); }
  }
  for (const key of ['RATE_LIMIT_AUTH_MAX', 'RATE_LIMIT_MEETING_MAX', 'RATE_LIMIT_DEFAULT_MAX']) {
    const value = config[key];
    if (value !== undefined && (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 100_000)) {
      errors.push(`${key} deve ser um inteiro entre 1 e 100000`);
    }
  }
  const trustedProxy = config.TRUST_PROXY;
  if (trustedProxy !== undefined && (!/^\d+$/.test(String(trustedProxy)) || Number(trustedProxy) > 10)) {
    errors.push('TRUST_PROXY deve ser o número de hops confiáveis entre 0 e 10');
  }

  const port = config.PORT;
  if (port !== undefined && (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535)) {
    errors.push('PORT deve ser um número entre 1 e 65535');
  }

  const cors = config.CORS_ORIGIN;
  if (isProduction && !(typeof cors === 'string' && cors.trim())) {
    errors.push('CORS_ORIGIN deve listar as origens HTTPS do frontend em produção');
  }
  if (typeof cors === 'string' && cors.trim()) {
    for (const origin of cors.split(',').map((value) => value.trim())) {
      try {
        const parsed = new URL(origin);
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || (isProduction && (origin === '*' || parsed.protocol !== 'https:'))) throw new Error();
      } catch {
        errors.push('CORS_ORIGIN deve conter origens válidas (HTTPS em produção) separadas por vírgula');
        break;
      }
    }
  }
  if (errors.length > 0) {
    throw new Error(`Configuração inválida:\n- ${errors.join('\n- ')}`);
  }
  return config;
}
