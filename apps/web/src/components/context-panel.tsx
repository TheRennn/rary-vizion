'use client';

import { useEffect, useState } from 'react';

export interface ContextPanelAction { label: string; onClick: () => void }
export interface ContextPanelDetails {
  title: string;
  eyebrow?: string;
  description?: string;
  fields?: [string, string][];
  actions?: ContextPanelAction[];
}

const EVENT_NAME = 'vizion:context-panel';

export function openContextPanel(details: ContextPanelDetails) {
  window.dispatchEvent(new CustomEvent<ContextPanelDetails>(EVENT_NAME, { detail: details }));
}

export function ContextPanel() {
  const [details, setDetails] = useState<ContextPanelDetails | null>(null);

  useEffect(() => {
    const open = (event: Event) => setDetails((event as CustomEvent<ContextPanelDetails>).detail);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDetails(null); };
    window.addEventListener(EVENT_NAME, open);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener(EVENT_NAME, open);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  if (!details) return null;
  return <div className="context-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetails(null); }}>
    <aside className="context-panel" role="dialog" aria-modal="true" aria-labelledby="context-panel-title">
      <header className="context-panel-header"><div className="min-w-0"><p className="eyebrow">{details.eyebrow ?? 'Detalhes'}</p><h2 id="context-panel-title" className="mt-1 truncate text-base font-semibold">{details.title}</h2></div><button className="icon-button" onClick={() => setDetails(null)} aria-label="Fechar painel">×</button></header>
      <div className="context-panel-body">
        {details.description && <p className="text-sm leading-6 text-muted">{details.description}</p>}
        {details.fields && details.fields.length > 0 && <dl className="context-field-list">{details.fields.map(([label, value]) => <div key={label} className="context-field"><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>}
        {details.actions?.map((action) => <button key={action.label} className="btn-ghost w-full justify-start" onClick={() => { action.onClick(); setDetails(null); }}>{action.label}</button>)}
      </div>
    </aside>
  </div>;
}
