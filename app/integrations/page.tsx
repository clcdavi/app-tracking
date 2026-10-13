'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, KeyRound, LoaderCircle, Plug, Plus, ShieldCheck, Trash2 } from 'lucide-react';

type IntegrationKey = { id: string; name: string; createdAt: string; lastUsedAt: string | null };

export default function IntegrationsPage() {
  const [keys, setKeys] = useState<IntegrationKey[]>([]);
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('/api/integrations/tasks');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [copied, setCopied] = useState('');

  const loadKeys = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/integrations/keys', { cache: 'no-store' });
      const result = await response.json() as { keys?: IntegrationKey[]; error?: string };
      if (response.status === 401) { setSignedOut(true); return; }
      if (!response.ok) throw new Error(result.error || 'No se pudieron cargar las conexiones.');
      setKeys(result.keys ?? []);
      setEndpoint(`${window.location.origin}/api/integrations/tasks`);
    } catch (reason) {
      setError((reason as Error).message || 'No se pudo conectar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadKeys(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadKeys]);

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setError('No se pudo copiar. Seleccioná y copiá el texto manualmente.');
    }
  }

  async function createKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/integrations/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const result = await response.json() as IntegrationKey & { token?: string; error?: string };
      if (response.status === 401) { setSignedOut(true); return; }
      if (!response.ok || !result.token) throw new Error(result.error || 'No se pudo crear la clave.');
      setKeys(current => [result, ...current]);
      setToken(result.token);
      setName('');
    } catch (reason) {
      setError((reason as Error).message || 'No se pudo crear la conexión.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(key: IntegrationKey) {
    if (!window.confirm(`¿Revocar “${key.name}”? La app que la usa dejará de poder enviar tareas.`)) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/integrations/keys/${encodeURIComponent(key.id)}`, { method: 'DELETE' });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'No se pudo revocar la clave.');
      setKeys(current => current.filter(item => item.id !== key.id));
    } catch (reason) {
      setError((reason as Error).message || 'No se pudo revocar la clave.');
    } finally {
      setBusy(false);
    }
  }

  const example = `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer TU_CLAVE_DE_ENFOCO' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "tasks": [{
      "externalId": "ticket-123",
      "title": "Responder al cliente",
      "area": "Trabajo",
      "project": "Soporte",
      "priority": 2,
      "minutes": 20,
      "deadline": "2026-10-20"
    }]
  }'`;

  return <main className="integrations-page">
    <Link href="/" className="integration-back"><ArrowLeft size={16}/> Volver a Enfoco</Link>
    <header className="integration-heading">
      <span className="integration-icon"><Plug size={21}/></span>
      <p className="eyebrow">ENFOCO · AUTOMATIZACIONES</p>
      <h1>Conectá otra app</h1>
      <p>Enviá tareas desde Apps Script, Make, n8n o cualquier servicio que pueda llamar una API.</p>
    </header>

    {error && <div className="integration-error" role="alert">{error}<button onClick={() => void loadKeys()}>Reintentar</button></div>}
    {signedOut && <div className="integration-card"><h2>Iniciá sesión</h2><p>Las conexiones se administran desde tu espacio privado.</p><a className="primary-btn" href="/signin-with-chatgpt?return_to=%2Fintegrations" target="_top">Iniciar sesión con ChatGPT</a></div>}

    {!signedOut && <>
      <section className="integration-card">
        <div className="integration-card-title"><div><h2>Crear clave de acceso</h2><p>Una clave por cada app. Podés revocarla cuando quieras.</p></div><KeyRound size={20}/></div>
        <form className="integration-key-form" onSubmit={createKey}>
          <label className="field">Nombre de la conexión<input value={name} onChange={event => setName(event.target.value)} required maxLength={80} placeholder="Ej.: Google Apps Script" /></label>
          <button className="primary-btn" disabled={busy || loading || keys.length >= 10}><Plus size={16}/>{busy ? 'Procesando…' : 'Crear clave'}</button>
        </form>
        {token && <div className="new-token"><div><b>Copiá esta clave ahora</b><p>Enfoco no volverá a mostrarla. Guardala en el gestor de secretos de la otra app.</p></div><code>{token}</code><button className="outline-btn" onClick={() => void copy(token, 'token')}>{copied === 'token' ? <Check size={16}/> : <Copy size={16}/>} {copied === 'token' ? 'Copiada' : 'Copiar clave'}</button><button className="token-dismiss" onClick={() => setToken('')}>Listo, ya la guardé</button></div>}
        <div className="security-note"><ShieldCheck size={17}/><span>La clave se guarda como hash, nunca se muestra de nuevo y solo permite ingresar tareas.</span></div>
      </section>

      <section className="integration-card">
        <div className="integration-card-title"><div><h2>Conexiones activas</h2><p>{keys.length} de 10 claves</p></div></div>
        {loading ? <p className="integration-muted"><LoaderCircle className="spin" size={16}/> Cargando…</p> : keys.length ? <div className="integration-key-list">{keys.map(key => <article className="integration-key-row" key={key.id}><KeyRound size={18}/><div><b>{key.name}</b><small>Creada {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(key.createdAt))}{key.lastUsedAt ? ` · Último uso ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(key.lastUsedAt))}` : ' · Sin usar todavía'}</small></div><button className="revoke-key" disabled={busy} onClick={() => void revoke(key)} aria-label={`Revocar ${key.name}`}><Trash2 size={16}/> Revocar</button></article>)}</div> : <p className="integration-muted">Todavía no hay conexiones. Creá una clave para empezar.</p>}
      </section>

      <section className="integration-card api-guide">
        <div className="integration-card-title"><div><h2>Cómo enviar tareas</h2><p>Usá una solicitud HTTP POST desde la otra app.</p></div></div>
        <label className="field">Endpoint<div className="copy-field"><code>{endpoint}</code><button className="icon-btn" onClick={() => void copy(endpoint, 'endpoint')} aria-label="Copiar endpoint">{copied === 'endpoint' ? <Check size={16}/> : <Copy size={16}/>}</button></div></label>
        <div className="guide-rules"><b>Reglas de entrada</b><ul><li>Mandá un objeto JSON con una lista <code>tasks</code>; admite hasta 50 por llamada.</li><li>El único campo obligatorio es <code>title</code>. Si omitís datos, la tarea entra en la Bandeja de entrada, área Personal, prioridad Media y 30 minutos.</li><li>Incluí un <code>externalId</code> estable para que los reintentos actualicen la misma tarea en lugar de duplicarla.</li><li>Las fechas usan <code>AAAA-MM-DD</code>. El máximo por solicitud es 100 KB.</li></ul></div>
        <pre className="api-example"><code>{example}</code></pre>
        <button className="outline-btn copy-example" onClick={() => void copy(example, 'example')}>{copied === 'example' ? <Check size={16}/> : <Copy size={16}/>} {copied === 'example' ? 'Ejemplo copiado' : 'Copiar ejemplo'}</button>
      </section>
      <p className="integration-footnote">No compartas la clave en código público ni la pongas en una app que se ejecute en el navegador. Guardala como secreto del servicio que envía las tareas.</p>
    </>}
  </main>;
}
