'use client';

import { FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth-provider';
import { api } from '@/lib/api';
import type { ChatConversation, ChatMessage, ChatMessagePage, Employee } from '@/lib/types';
import { openContextPanel } from '@/components/context-panel';

interface ChatSearchResult {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string };
  conversation: { id: string; name: string | null; peerName: string };
}

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const messages = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export default function ChatPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [messageResults, setMessageResults] = useState<ChatSearchResult[]>([]);
  const [searchingMessages, setSearchingMessages] = useState(false);
  const [messageSearchError, setMessageSearchError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const threadEnd = useRef<HTMLDivElement>(null);
  const threadViewport = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const loadingOlderRef = useRef(false);
  const preservedScrollHeight = useRef<number | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api<ChatConversation[]>('/chat/conversations'));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar conversas');
    }
  }, []);

  const loadMessages = useCallback(async (
    conversationId: string,
    options: { before?: string; initial?: boolean } = {},
  ) => {
    try {
      const params = new URLSearchParams();
      if (options.before) params.set('before', options.before);
      const serializedParams = params.toString();
      const query = serializedParams ? `?${serializedParams}` : '';
      const page = await api<ChatMessagePage>(
        `/chat/conversations/${conversationId}/messages${query}`,
      );
      if (selectedIdRef.current !== conversationId) return;
      setMessages((current) => mergeMessages(current, page.items));
      if (options.initial || options.before) setHasOlderMessages(page.hasMore);
      if (!options.before) {
        await api(`/chat/conversations/${conversationId}/read`, { method: 'PATCH' });
      }
    } catch (e) {
      preservedScrollHeight.current = null;
      setError(e instanceof Error ? e.message : 'Erro ao carregar mensagens');
    } finally {
      if (options.before) {
        loadingOlderRef.current = false;
        setLoadingOlder(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadConversations();
    void api<Employee[]>('/users').then(setEmployees).catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar pessoas'));
  }, [loadConversations]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    setMessages([]);
    setHasOlderMessages(false);
    if (!selectedId) return;
    void loadMessages(selectedId, { initial: true });
    const interval = setInterval(() => {
      if (!loadingOlderRef.current) void loadMessages(selectedId);
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedId, loadMessages]);

  useLayoutEffect(() => {
    if (preservedScrollHeight.current !== null && threadViewport.current) {
      const viewport = threadViewport.current;
      viewport.scrollTop += viewport.scrollHeight - preservedScrollHeight.current;
      preservedScrollHeight.current = null;
      return;
    }
    threadEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const interval = setInterval(() => void loadConversations(), 10000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    const term = messageSearch.trim();
    setMessageSearchError(null);
    if (term.length < 2) {
      setMessageResults([]);
      setSearchingMessages(false);
      return;
    }

    let cancelled = false;
    setMessageResults([]);
    setSearchingMessages(true);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ q: term, limit: '30' });
      api<ChatSearchResult[]>(`/chat/search?${params.toString()}`)
        .then((results) => { if (!cancelled) setMessageResults(results); })
        .catch((e) => { if (!cancelled) setMessageSearchError(e instanceof Error ? e.message : 'Erro ao pesquisar mensagens'); })
        .finally(() => { if (!cancelled) setSearchingMessages(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [messageSearch]);

  async function startConversation(targetUserId: string) {
    try {
      const conversation = await api<ChatConversation>('/chat/conversations', {
        method: 'POST',
        body: { targetUserId },
      });
      setPeopleOpen(false);
      setSearch('');
      setSelectedId(conversation.id);
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao iniciar conversa');
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    try {
      await api(`/chat/conversations/${selectedId}/messages`, {
        method: 'POST',
        body: { body: draft.trim() },
      });
      setDraft('');
      await Promise.all([loadMessages(selectedId), loadConversations()]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  }

  function loadOlderMessages() {
    const oldestMessage = messages[0];
    if (!selectedId || !oldestMessage || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    preservedScrollHeight.current = threadViewport.current?.scrollHeight ?? null;
    setLoadingOlder(true);
    void loadMessages(selectedId, { before: oldestMessage.id });
  }

  if (!user) return null;

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;
  const availablePeople = employees.filter((employee) =>
    employee.active &&
    employee.id !== user.id &&
    `${employee.name} ${employee.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[20rem] overflow-hidden rounded-lg border border-line/90 bg-surface/90 shadow-none md:h-[calc(100dvh-5.5rem)] md:min-h-[24rem]">
      <aside className={`${selectedId ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-line/80 md:w-[300px] md:shrink-0`}>
        <div className="border-b border-line/80 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="eyebrow">Comunicação</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight">Chat</h1>
            </div>
            <button
              type="button"
              aria-label="Nova conversa"
              className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-lg shadow-[0_8px_24px_rgba(139,92,246,.18)]"
              onClick={() => setPeopleOpen((open) => !open)}
            >
              +
            </button>
          </div>

          {peopleOpen && (
            <div className="mb-3 rounded-xl border border-line bg-bg p-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pessoa..."
                className="input mb-2"
                autoFocus
              />
              <div className="max-h-48 overflow-y-auto">
                {availablePeople.map((employee) => (
                  <button
                    type="button"
                    key={employee.id}
                    onClick={() => void startConversation(employee.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface2"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(employee.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{employee.name}</span>
                      <span className="block truncate text-xs text-muted">{employee.jobTitle ?? employee.email}</span>
                    </span>
                  </button>
                ))}
                {availablePeople.length === 0 && <p className="px-2 py-3 text-xs text-muted">Nenhuma pessoa encontrada.</p>}
              </div>
            </div>
          )}

          <label className="sr-only" htmlFor="chat-message-search">Pesquisar mensagens</label>
          <input
            id="chat-message-search"
            type="search"
            value={messageSearch}
            onChange={(event) => setMessageSearch(event.target.value)}
            placeholder="Pesquisar mensagens..."
            className="input"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {messageSearch.trim().length >= 2 ? (
            <div className="space-y-1">
              <p className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted">Resultados da busca</p>
              {messageSearchError && <p role="alert" className="mx-2 rounded-lg border border-red-400/20 bg-red-400/5 px-3 py-2 text-xs text-red-300">{messageSearchError}</p>}
              {searchingMessages && <p className="px-3 py-4 text-sm text-muted">Pesquisando mensagens…</p>}
              {!searchingMessages && messageResults.map((result) => (
                <button key={result.id} type="button" onClick={() => { setSelectedId(result.conversation.id); setMessageSearch(''); }} className="block w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-white/[0.035]">
                  <span className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold">{result.conversation.peerName}</span><time className="shrink-0 text-[10px] text-muted" dateTime={result.createdAt}>{timeLabel(result.createdAt)}</time></span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted">{result.sender.name}: {result.body}</span>
                </button>
              ))}
              {!searchingMessages && messageResults.length === 0 && <p className="px-3 py-4 text-sm text-muted">Nenhuma mensagem encontrada nas suas conversas.</p>}
            </div>
          ) : conversations.map((conversation) => (
            <button
              type="button"
              key={conversation.id}
              onClick={() => setSelectedId(conversation.id)}
              className={`mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                selectedId === conversation.id ? 'bg-primary/12' : 'hover:bg-white/[0.035]'
              }`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface2 text-sm font-semibold text-primary">
                {initials(conversation.peer?.name ?? 'Chat')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{conversation.peer?.name ?? 'Conversa'}</span>
                  {conversation.lastMessage && <span className="text-[10px] text-muted">{timeLabel(conversation.lastMessage.createdAt)}</span>}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-muted">{conversation.lastMessage?.body ?? 'Comece uma conversa'}</span>
                  {conversation.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </span>
              </span>
            </button>
          ))}
          {messageSearch.trim().length < 2 && conversations.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-muted">Nenhuma conversa ainda.</p>
              <button type="button" className="btn-ghost mt-4" onClick={() => setPeopleOpen(true)}>Nova conversa</button>
            </div>
          )}
        </div>
      </aside>

      <section className={`${selectedId ? 'flex' : 'hidden md:flex'} min-w-0 flex-1 flex-col`}>
        {selected ? (
          <>
            <header className="flex h-[73px] items-center gap-3 border-b border-line/80 px-4">
              <button type="button" className="rounded-lg p-2 text-muted md:hidden" onClick={() => setSelectedId(null)} aria-label="Voltar">
                ←
              </button>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-xs font-semibold text-primary">
                {initials(selected.peer?.name ?? 'Chat')}
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{selected.peer?.name ?? 'Conversa'}</h2>
                <p className="truncate text-xs text-muted">{selected.peer?.jobTitle ?? selected.peer?.email}</p>
              </div>
              <button type="button" className="icon-button ml-auto" aria-label="Detalhes da conversa" title="Detalhes da conversa" onClick={() => openContextPanel({
                title: selected.peer?.name ?? 'Conversa',
                eyebrow: 'Chat direto',
                description: selected.peer?.jobTitle ?? 'Informações de contato do colaborador.',
                fields: [['E-mail', selected.peer?.email ?? ''], ['Cargo', selected.peer?.jobTitle ?? 'Não informado'], ['Mensagens carregadas', String(messages.length)], ['Não lidas', selected.unread ? 'Sim' : 'Não']],
              })}>ⓘ</button>
            </header>

            <div ref={threadViewport} className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
              {hasOlderMessages && (
                <div className="mb-4 text-center">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={loadOlderMessages}
                    disabled={loadingOlder}
                  >
                    {loadingOlder ? 'Carregando...' : 'Carregar mensagens anteriores'}
                  </button>
                </div>
              )}
              {messages.length === 0 ? (
                <div className="grid h-full place-items-center">
                  <div className="text-center">
                    <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {initials(selected.peer?.name ?? 'Chat')}
                    </span>
                    <p className="mt-3 text-sm text-muted">Envie a primeira mensagem para {selected.peer?.name.split(' ')[0]}.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((message) => {
                    const mine = message.senderId === user.id;
                    return (
                      <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[82%] sm:max-w-[68%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                          <div className={`rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                            mine
                              ? 'rounded-br-md bg-primary text-white'
                              : 'rounded-bl-md border border-line bg-surface2 text-fg'
                          }`}>
                            {message.body}
                          </div>
                          <time className="mt-1 px-1 text-[10px] text-muted" dateTime={message.createdAt}>
                            {timeLabel(message.createdAt)}
                          </time>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadEnd} />
                </div>
              )}
            </div>

            <form onSubmit={sendMessage} className="border-t border-line/80 p-3 sm:p-4">
              {error && <p role="alert" className="mb-2 text-xs text-red-300">{error}</p>}
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface2/60 p-1.5 focus-within:border-primary/60">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Escreva uma mensagem..."
                  maxLength={4000}
                  className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted/70"
                />
                <button type="submit" disabled={sending || !draft.trim()} className="btn h-10 px-4">
                  {sending ? '...' : 'Enviar'}
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="grid h-full place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-primary/20 bg-primary/10 text-xl font-semibold text-primary">C</div>
              <h2 className="mt-4 text-lg font-semibold">Selecione uma conversa</h2>
              <p className="mt-1 max-w-sm text-sm text-muted">Escolha um colaborador para começar a conversar com sua equipe.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
