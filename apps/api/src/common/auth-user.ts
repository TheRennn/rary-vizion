import { Role } from './domain-types';

/** Identidade e contexto carregados pelo guard a partir do JWT Supabase validado. */
export interface AuthUser {
  id: string;
  companyId: string;
  role: Role;
  name: string;
  email: string;
  /** Access token mantido somente no servidor para logout/refresh. */
  sessionId: string;
}
