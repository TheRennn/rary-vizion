import { BadRequestException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

type Query = Record<string, any>;
type SupabaseModel = {
  findMany(args?: Query): Promise<any[]>;
  findFirst(args?: Query): Promise<any | null>;
  findUnique(args?: Query): Promise<any | null>;
  count(args?: Query): Promise<number>;
  create(args: Query): Promise<any>;
  createMany(args: Query): Promise<{ count: number }>;
  update(args: Query): Promise<any>;
  updateMany(args: Query): Promise<{ count: number }>;
  upsert(args: Query): Promise<any>;
  deleteMany(args: Query): Promise<{ count: number }>;
};

const models: Record<string, string> = {
  company: 'companies', department: 'departments', user: 'users', session: 'sessions',
  permissionGrant: 'permission_grants', timeEntry: 'time_entries', auditLog: 'audit_logs',
  activityEvent: 'activity_events',
  conversation: 'conversations', conversationParticipant: 'conversation_participants',
  chatMessage: 'chat_messages', project: 'projects', projectTask: 'project_tasks', projectTaskComment: 'project_task_comments', projectTaskDependency: 'project_task_dependencies',
  meeting: 'meetings', meetingParticipant: 'meeting_participants', notification: 'notifications',
  workspacePreference: 'workspace_preferences', focusSession: 'focus_sessions', calendarEvent: 'calendar_events',
};
const relations: Record<string, Record<string, string>> = {
  users: { company: 'companies', department: 'departments', timeEntries: 'time_entries', sessions: 'sessions', conversations: 'conversation_participants', sentMessages: 'chat_messages' },
  departments: { users: 'users' }, companies: { users: 'users', departments: 'departments' },
  projects: { tasks: 'project_tasks' }, project_tasks: { project: 'projects' },
  project_task_comments: { author: 'users' },
  activity_events: { actor: 'users' },
  meetings: { participants: 'meeting_participants' },
  focus_sessions: { task: 'project_tasks' },
  conversations: { participants: 'conversation_participants', messages: 'chat_messages' },
  conversation_participants: { user: 'users', conversation: 'conversations' },
  chat_messages: { sender: 'users', conversation: 'conversations' },
};
const snake = (value: string) => value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
const camel = (value: string) => value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const dateField = (key: string) => /(?:At|Date)$/.test(key) && key !== 'metadata';

function toCamel(value: any): any {
  if (Array.isArray(value)) return value.map(toCamel);
  if (!value || typeof value !== 'object') return value;
  const output: Query = {};
  for (const [key, child] of Object.entries(value)) {
    const name = camel(key);
    if (Array.isArray(child) && child.length === 1 && child[0] && Object.keys(child[0]).length === 1 && 'count' in child[0]) {
      output._count = { ...(output._count ?? {}), [name]: child[0].count };
    } else if (child && typeof child === 'string' && dateField(name) && !Number.isNaN(Date.parse(child))) output[name] = new Date(child);
    else output[name] = toCamel(child);
  }
  return output;
}

function selectString(table: string, options: Query): string {
  const fields = options.select ? Object.entries(options.select).filter(([, v]) => v === true).map(([k]) => snake(k)) : ['*'];
  const nested = { ...(options.include ?? {}) } as Query;
  for (const [key, value] of Object.entries(options.select ?? {})) if (value && typeof value === 'object') nested[key] = value;
  for (const [key, value] of Object.entries(nested)) {
    if (key === '_count') continue;
    const relation = relations[table]?.[key];
    if (!relation) continue;
    const nestedOptions = value === true ? {} : value;
    const inner = selectString(relation, nestedOptions);
    fields.push(`${key}:${relation}(${inner})`);
  }
  if (options.include?._count || options.select?._count) {
    const countOptions = options.include?._count ?? options.select?._count;
    for (const [key] of Object.entries(countOptions.select ?? {})) {
      const relation = relations[table]?.[key];
      if (relation) fields.push(`${key}:${relation}(count)`);
    }
  }
  return fields.join(',');
}

@Injectable()
export class SupabaseDataService implements OnModuleDestroy {
  readonly publicClient: SupabaseClient;
  readonly adminClient: SupabaseClient;
  readonly configured: boolean;
  readonly local: boolean;
  readonly development: boolean;
  declare readonly company: SupabaseModel;
  declare readonly department: SupabaseModel;
  declare readonly user: SupabaseModel;
  declare readonly session: SupabaseModel;
  declare readonly permissionGrant: SupabaseModel;
  declare readonly timeEntry: SupabaseModel;
  declare readonly auditLog: SupabaseModel;
  declare readonly activityEvent: SupabaseModel;
  declare readonly conversation: SupabaseModel;
  declare readonly conversationParticipant: SupabaseModel;
  declare readonly chatMessage: SupabaseModel;
  declare readonly project: SupabaseModel;
  declare readonly projectTask: SupabaseModel;
  declare readonly projectTaskComment: SupabaseModel;
  declare readonly projectTaskDependency: SupabaseModel;
  declare readonly meeting: SupabaseModel;
  declare readonly meetingParticipant: SupabaseModel;
  declare readonly notification: SupabaseModel;
  declare readonly workspacePreference: SupabaseModel;
  declare readonly focusSession: SupabaseModel;
  declare readonly calendarEvent: SupabaseModel;
  private readonly modelCache = new Map<string, any>();

  constructor(config: ConfigService) {
    const url = config.get<string>('SUPABASE_URL');
    const publicKey = config.get<string>('SUPABASE_PUBLISHABLE_KEY');
    const secretKey = config.get<string>('SUPABASE_SECRET_KEY');
    this.configured = !!url && !!publicKey && !!secretKey;
    const parsedUrl = url ? new URL(url) : null;
    this.local = config.get<string>('SUPABASE_LOCAL') === 'true'
      && config.get<string>('NODE_ENV') !== 'production'
      && !!parsedUrl
      && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(parsedUrl.hostname);
    this.development = config.get<string>('SUPABASE_ENVIRONMENT') === 'development'
      && !!parsedUrl
      && parsedUrl.hostname === `${config.get<string>('SUPABASE_PROJECT_REF')}.supabase.co`;
    if (!this.configured) throw new Error('Configure SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY em apps/api/.env');
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
    if (typeof Reflect.get(globalThis, 'WebSocket') !== 'function') Object.assign(globalThis, { WebSocket });
    this.publicClient = createClient(url!, publicKey!, options);
    this.adminClient = createClient(url!, secretKey!, options);
    return new Proxy(this, {
      get: (target, property, receiver) => {
        if (typeof property === 'string' && models[property]) return target.model(property);
        if (property === '$transaction') return async (callback: any) => callback(receiver);
        return Reflect.get(target, property, receiver);
      },
    });
  }

  async $transaction<T>(callback: (tx: SupabaseDataService) => Promise<T>): Promise<T> { return callback(this); }

  async healthCheck(): Promise<void> {
    const { error } = await this.adminClient.from('companies').select('id').limit(1);
    if (error) throw new Error(`Supabase indisponível: ${error.message}`);
  }

  async recordTimeEntry(companyId: string, userId: string, type: string, note: string | null) {
    const { data, error } = await this.adminClient.rpc('record_time_entry', {
      p_company_id: companyId, p_user_id: userId, p_type: type, p_note: note,
    });
    if (error) {
      if (error.code === 'P0001') throw new BadRequestException(error.message);
      throw this.dbError(error);
    }
    return toCamel(data);
  }

  private model(name: string): any {
    if (this.modelCache.has(name)) return this.modelCache.get(name);
    const table = models[name];
    const result = {
      findMany: (args: Query = {}) => this.find(table, args, false),
      findFirst: (args: Query = {}) => this.find(table, args, true),
      findUnique: (args: Query = {}) => this.find(table, args, true),
      count: (args: Query = {}) => this.count(table, args),
      create: (args: Query) => this.create(table, args),
      createMany: (args: Query) => this.createMany(table, args),
      update: (args: Query) => this.update(table, args, false),
      updateMany: (args: Query) => this.update(table, args, true),
      upsert: (args: Query) => this.upsert(table, args),
      deleteMany: (args: Query) => this.deleteMany(table, args),
    };
    this.modelCache.set(name, result);
    return result;
  }

  private applyWhere(query: any, where: Query = {}): any {
    for (const [key, condition] of Object.entries(where)) {
      if (key === 'AND') { for (const clause of Array.isArray(condition) ? condition : [condition]) query = this.applyWhere(query, clause as Query); continue; }
      if (key === 'OR') {
        const clauses = (condition as Query[]).map((clause) => this.toPostgrest(clause));
        if (clauses.length) query = query.or(clauses.join(','));
        continue;
      }
      if (key === 'NOT' || !Object.keys(where).includes(key)) continue;
      if (condition === null) { query = query.is(snake(key), null); continue; }
      if (!condition || typeof condition !== 'object' || condition instanceof Date || Array.isArray(condition)) { query = query.eq(snake(key), condition instanceof Date ? condition.toISOString() : condition); continue; }
      if (!Object.keys(condition).some((part) => ['equals','in','not','contains','startsWith','gt','gte','lt','lte'].includes(part))) {
        if (key.includes('_')) query = this.applyWhere(query, condition as Query);
        else query = query.not(key, 'is', null);
        continue;
      }
      for (const [operator, value] of Object.entries(condition)) {
        const column = snake(key);
        if (operator === 'equals') query = query.eq(column, value instanceof Date ? value.toISOString() : value);
        else if (operator === 'in') query = query.in(column, value as any[]);
        else if (operator === 'not') query = value === null ? query.not(column, 'is', null) : query.neq(column, value);
        else if (operator === 'contains') query = query.ilike(column, `%${value}%`);
        else if (operator === 'startsWith') query = query.ilike(column, `${value}%`);
        else if (['gt', 'gte', 'lt', 'lte'].includes(operator)) query = query[operator](column, value instanceof Date ? value.toISOString() : value);
      }
    }
    return query;
  }

  private toPostgrest(where: Query, prefix = ''): string {
    return Object.entries(where).map(([field, value]) => {
      if (field === 'OR') return `or(${(value as Query[]).map((item) => this.toPostgrest(item)).join(',')})`;
      if (field === 'AND') return `and(${(Array.isArray(value) ? value : [value]).map((item) => this.toPostgrest(item)).join(',')})`;
      if (value && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) {
        if ('some' in value) return this.toPostgrest(value.some as Query, `${prefix}${field}.`);
        if ('not' in value) return `${prefix}${snake(field)}.neq.${String(value.not)}`;
        const operators = Object.entries(value).map(([operator, operand]) => {
          const op = ({ equals: 'eq', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte', not: 'neq', contains: 'ilike', startsWith: 'ilike' } as Record<string,string>)[operator];
          if (operator === 'in') return `${prefix}${snake(field)}.in.(${(operand as any[]).join(',')})`;
          if (!op) return `${prefix}${snake(field)}.${this.toPostgrest({ [operator]: operand })}`;
          const val = operator === 'contains' ? `*${operand}*` : operator === 'startsWith' ? `${operand}*` : String(operand instanceof Date ? operand.toISOString() : operand);
          return `${prefix}${snake(field)}.${op}.${val}`;
        });
        return operators.join(',');
      }
      return `${prefix}${snake(field)}.eq.${String(value instanceof Date ? value.toISOString() : value)}`;
    }).join(',');
  }

  private async find(table: string, args: Query, single: boolean): Promise<any> {
    let query = this.adminClient.from(table).select(selectString(table, args));
    query = this.applyWhere(query, args.where);
    if (args.cursor?.id) {
      const { data: cursor, error: cursorError } = await this.adminClient.from(table).select('id,created_at').eq('id', args.cursor.id).maybeSingle();
      if (cursorError) throw this.dbError(cursorError);
      if (!cursor) return single ? null : [];
      const createdAt = String(cursor.created_at);
      query = query.or(`created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${cursor.id})`);
    }
    const order = Array.isArray(args.orderBy) ? args.orderBy : args.orderBy ? [args.orderBy] : [];
    for (const item of order) for (const [field, direction] of Object.entries(item)) query = query.order(snake(field), { ascending: direction === 'asc' });
    if (args.skip && !args.cursor) query = query.range(args.skip, args.skip + (args.take ?? 1000) - 1);
    else if (args.take !== undefined) query = query.limit(args.take);
    else if (!single) query = query.limit(1000);
    const response = single ? await query.maybeSingle() : await query;
    if (response.error) throw this.dbError(response.error);
    let data = toCamel(response.data);
    if (args.distinct && Array.isArray(data)) {
      const keys = Array.isArray(args.distinct) ? args.distinct : [args.distinct];
      const seen = new Set();
      data = data.filter((row: any) => { const key = keys.map((field: string) => row[field]).join('|'); if (seen.has(key)) return false; seen.add(key); return true; });
    }
    return data;
  }

  private async count(table: string, args: Query): Promise<number> {
    let query = this.adminClient.from(table).select('*', { count: 'exact', head: true });
    query = this.applyWhere(query, args.where);
    const { count, error } = await query;
    if (error) throw this.dbError(error);
    return count ?? 0;
  }

  private data(input: Query = {}): Query {
    const output: Query = {};
    for (const [key, value] of Object.entries(input)) {
      if (key === 'department' && value?.connect) output.department_id = value.connect.id;
      else if (key === 'department' && value?.disconnect) output.department_id = null;
      else if (key === 'company' && value?.connect) output.company_id = value.connect.id;
      else if (key === 'project' && value?.connect) output.project_id = value.connect.id;
      else output[snake(key)] = value instanceof Date ? value.toISOString() : value;
    }
    return output;
  }

  private async create(table: string, args: Query): Promise<any> {
    const input = { ...args.data };
    const nested = Object.entries(input).filter(([, value]) => value && typeof value === 'object' && 'create' in (value as object));
    for (const [key] of nested) delete input[key];
    const { data, error } = await this.adminClient.from(table).insert(this.data(input)).select('id').single();
    if (error) throw this.dbError(error);
    const parent = data as { id: string };
    for (const [relationKey, value] of nested) {
      const childTable = relations[table]?.[relationKey];
      if (!childTable) continue;
      const foreignKey = table === 'meetings' ? 'meetingId' : table === 'conversations' ? 'conversationId' : `${table.slice(0, -1)}Id`;
      const rows = (Array.isArray((value as Query).create) ? (value as Query).create : [(value as Query).create]).map((row: Query) => ({ ...row, [foreignKey]: parent.id }));
      const { error: childError } = await this.adminClient.from(childTable).insert(rows.map((row: Query) => this.data(row)));
      if (childError) throw this.dbError(childError);
    }
    return nested.length ? this.find(table, { where: { id: parent.id }, include: args.include, select: args.select }, true) : toCamel(data);
  }
  private async createMany(table: string, args: Query): Promise<any> {
    const rows = (Array.isArray(args.data) ? args.data : [args.data]).map((row) => this.data(row));
    if (!rows.length) return { count: 0 };
    const { data, error } = await this.adminClient.from(table).insert(rows).select('id');
    if (error) throw this.dbError(error);
    return { count: data?.length ?? rows.length };
  }
  private async update(table: string, args: Query, many: boolean): Promise<any> {
    let query = this.adminClient.from(table).update(this.data(args.data));
    query = this.applyWhere(query, args.where);
    const { data, error } = await query.select(selectString(table, args));
    if (error) throw this.dbError(error);
    const rows = toCamel(data ?? []);
    if (many) return { count: rows.length };
    if (!rows.length) throw Object.assign(new Error('Registro não encontrado'), { code: 'P2025' });
    return rows[0];
  }
  private async upsert(table: string, args: Query): Promise<any> {
    const rawKey = args.where ?? {};
    const key = Object.keys(rawKey).length === 1 && rawKey[Object.keys(rawKey)[0]] && typeof rawKey[Object.keys(rawKey)[0]] === 'object'
      ? rawKey[Object.keys(rawKey)[0]] : rawKey;
    const { data, error } = await this.adminClient.from(table).upsert(this.data({ ...args.create, ...args.update }), { onConflict: Object.keys(key ?? {}).map(snake).join(',') }).select(selectString(table, args)).single();
    if (error) throw this.dbError(error);
    return toCamel(data);
  }
  private async deleteMany(table: string, args: Query): Promise<any> {
    let query = this.adminClient.from(table).delete();
    query = this.applyWhere(query, args.where);
    const { data, error } = await query.select('id');
    if (error) throw this.dbError(error);
    return { count: data?.length ?? 0 };
  }
  private dbError(error: any): Error & { code?: string } {
    const mapped = new Error(error.message) as Error & { code?: string };
    mapped.code = error.code === '23505' ? 'P2002' : error.code;
    return mapped;
  }
  onModuleDestroy(): void {}
}
