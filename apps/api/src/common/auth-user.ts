import { Role } from './domain-types';

/** Usuário autenticado anexado ao request pelo JwtStrategy. */
export interface AuthUser {
  id: string;
  companyId: string;
  role: Role;
  name: string;
  email: string;
}
