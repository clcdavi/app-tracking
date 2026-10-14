'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Plug,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

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

  // Telegram integration states
  const [tgConnected, setTgConnected] = useState(false);
  const [tgConfigured, setTgConfigured] = useState(false);
  const [tgBotUsername, setTgBotUsername] = useState('');
  const [tgLink, setTgLink] = useState('');
  const [tgLoading, setTgLoading] = useState(true);
  const [tgBusy, setTgBusy] = useState(false);

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

  const loadTelegramStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/telegram/link', { cache: 'no-store' });
      if (res.status === 401) return;
      if (res.ok) {
        const data = await res.json() as { connected: boolean; configured: boolean; botUsername: string };
        setTgConnected(data.connected);
        setTgConfigured(data.configured);
        setTgBotUsername(data.botUsername);
      }
    } catch {
      // Ignore network errors
    } finally {
      setTgLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadKeys();
      void loadTelegramStatus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadKeys, loadTelegramStatus]);

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
      const response = await fetch('/api/integrations/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
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

  async function connectTelegram() {
    setTgBusy(true);
    setError('');
    try {
      const res = await fetch('/api/integrations/telegram/link', { method: 'POST' });
      const data = await res.json() as { link?: string; botUsername?: string; error?: string };
      if (!res.ok || !data.link) throw new Error(data.error || 'No se pudo generar el enlace de conexión.');
      setTgLink(data.link);
      if (data.botUsername) setTgBotUsername(data.botUsername);
      window.open(data.link, '_blank');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTgBusy(false);
    }
  }

  async function disconnectTelegram() {
    if (!window.confirm('¿Desvincular Telegram? Dejarás de recibir y crear tareas desde el bot.')) return;
    setTgBusy(true);
    setError('');
    try {
      const res = await fetch('/api/integrations/telegram/link', { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo desvincular.');
      setTgConnected(false);
      setTgLink('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTgBusy(false);
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

  return (
    <main className="integrations-page">
      <Link href="/" className="integration-back"><ArrowLeft size={16}/> Volver a Enfoco</Link>
      <header className="integration-heading">
        <span className="integration-icon"><Plug size={21}/></span>
        <p className="eyebrow">ENFOCO · AUTOMATIZACIONES</p>
        <h1>Conectá otra app</h1>
        <p>Capturá tareas al instante desde Telegram o enviá datos mediante API REST.</p>
      </header>

      {error && <div className="integration-error" role="alert">{error}<button onClick={() => void loadKeys()}>Reintentar</button></div>}
      {signedOut && (
        <div className="integration-card">
          <h2>Iniciá sesión</h2>
          <p>Las conexiones se administran desde tu espacio privado.</p>
          <Link className="primary-btn" href="/login?return_to=%2Fintegrations">Iniciar sesión</Link>
        </div>
      )}

      {!signedOut && (
        <>
          {/* Telegram Bot Card */}
          <section className="integration-card telegram-card">
            <div className="integration-card-title">
              <div>
                <h2>Bot de Telegram</h2>
                <p>Creá tareas al instante enviando un mensaje de texto o audio desde cualquier lugar.</p>
              </div>
              <Send size={22} className="telegram-icon" />
            </div>

            {tgLoading ? (
              <p className="integration-muted"><LoaderCircle className="spin" size={16}/> Cargando estado de Telegram…</p>
            ) : tgConnected ? (
              <div className="telegram-status connected">
                <div className="status-indicator">
                  <CheckCircle2 size={22} style={{ color: '#2e7d32', flexShrink: 0 }} />
                  <div>
                    <b style={{ color: '#1b5e20', fontSize: '15px' }}>Tu cuenta está vinculada a Telegram</b>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#4b6354' }}>
                      Cualquier mensaje que le envíes al bot se guardará automáticamente en tu Enfoco.
                    </p>
                  </div>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    className="outline-btn"
                    style={{ color: '#b71c1c' }}
                    onClick={disconnectTelegram}
                    disabled={tgBusy}
                  >
                    {tgBusy ? 'Desconectando…' : 'Desvincular Telegram'}
                  </button>
                  {tgBotUsername && (
                    <a
                      href={`https://t.me/${tgBotUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-btn"
                      style={{ fontSize: '13px' }}
                    >
                      <ExternalLink size={14} /> Abrir chat con @{tgBotUsername}
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div className="telegram-connect-box">
                <p style={{ fontSize: '14px', color: '#526682', marginBottom: '16px', lineHeight: 1.6 }}>
                  Conectá tu bot de Telegram para capturar pendientes sin abrir la app.
                </p>

                {tgLink ? (
                  <div className="telegram-link-action" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <a
                      href={tgLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-btn"
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <ExternalLink size={16} /> Abrir Telegram para vincular (@{tgBotUsername || 'Enfoco'})
                    </a>
                    <p style={{ fontSize: '12px', color: '#687b94' }}>
                      Hacé clic en el botón y luego presioná <b>Iniciar</b> en Telegram. El enlace expira en 15 minutos.
                    </p>
                  </div>
                ) : (
                  <button
                    className="primary-btn"
                    onClick={connectTelegram}
                    disabled={tgBusy}
                  >
                    <Send size={16} /> {tgBusy ? 'Generando enlace…' : 'Conectar con Telegram'}
                  </button>
                )}
              </div>
            )}

            <div className="telegram-cheat-sheet" style={{ marginTop: '20px', borderTop: '1px solid #edf1f7', paddingTop: '16px', fontSize: '13px', color: '#5a6e87' }}>
              <b style={{ color: '#273a52', display: 'block', marginBottom: '8px' }}>💡 Sintaxis y ejemplos:</b>
              <ul style={{ paddingLeft: '18px', margin: 0, lineHeight: 1.6 }}>
                <li><code>Comprar leche</code> &rarr; Entra en tu bandeja de entrada</li>
                <li><code>Preparar reporte #trabajo !alta hoy 45m</code> &rarr; Área Trabajo, prioridad Alta, 45 min, para hoy</li>
                <li><code>Repasar apuntes #estudio mañana 1h</code> &rarr; Planificado para mañana</li>
              </ul>
            </div>
          </section>

          {/* API Keys Card */}
          <section className="integration-card">
            <div className="integration-card-title">
              <div>
                <h2>Crear clave de acceso API</h2>
                <p>Una clave por cada app externa. Podés revocarla cuando quieras.</p>
              </div>
              <KeyRound size={20}/>
            </div>
            <form className="integration-key-form" onSubmit={createKey}>
              <label className="field">
                Nombre de la conexión
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  required
                  maxLength={80}
                  placeholder="Ej.: Google Apps Script"
                />
              </label>
              <button className="primary-btn" disabled={busy || loading || keys.length >= 10}>
                <Plus size={16}/>{busy ? 'Procesando…' : 'Crear clave'}
              </button>
            </form>
            {token && (
              <div className="new-token">
                <div>
                  <b>Copiá esta clave ahora</b>
                  <p>Enfoco no volverá a mostrarla. Guardala en el gestor de secretos de la otra app.</p>
                </div>
                <code>{token}</code>
                <button className="outline-btn" onClick={() => void copy(token, 'token')}>
                  {copied === 'token' ? <Check size={16}/> : <Copy size={16}/>} {copied === 'token' ? 'Copiada' : 'Copiar clave'}
                </button>
                <button className="token-dismiss" onClick={() => setToken('')}>Listo, ya la guardé</button>
              </div>
            )}
            <div className="security-note">
              <ShieldCheck size={17}/>
              <span>La clave se guarda como hash, nunca se muestra de nuevo y solo permite ingresar tareas.</span>
            </div>
          </section>

          <section className="integration-card">
            <div className="integration-card-title">
              <div>
                <h2>Conexiones activas</h2>
                <p>{keys.length} de 10 claves</p>
              </div>
            </div>
            {loading ? (
              <p className="integration-muted"><LoaderCircle className="spin" size={16}/> Cargando…</p>
            ) : keys.length ? (
              <div className="integration-key-list">
                {keys.map(key => (
                  <article className="integration-key-row" key={key.id}>
                    <KeyRound size={18}/>
                    <div>
                      <b>{key.name}</b>
                      <small>
                        Creada {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(key.createdAt))}
                        {key.lastUsedAt ? ` · Último uso ${new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date(key.lastUsedAt))}` : ' · Sin usar todavía'}
                      </small>
                    </div>
                    <button className="revoke-key" disabled={busy} onClick={() => void revoke(key)} aria-label={`Revocar ${key.name}`}>
                      <Trash2 size={16}/> Revocar
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <p className="integration-muted">Todavía no hay conexiones. Creá una clave para empezar.</p>
            )}
          </section>

          <section className="integration-card api-guide">
            <div className="integration-card-title">
              <div>
                <h2>Cómo enviar tareas por API</h2>
                <p>Usá una solicitud HTTP POST desde la otra app.</p>
              </div>
            </div>
            <label className="field">
              Endpoint
              <div className="copy-field">
                <code>{endpoint}</code>
                <button className="icon-btn" onClick={() => void copy(endpoint, 'endpoint')} aria-label="Copiar endpoint">
                  {copied === 'endpoint' ? <Check size={16}/> : <Copy size={16}/>}
                </button>
              </div>
            </label>
            <div className="guide-rules">
              <b>Reglas de entrada</b>
              <ul>
                <li>Mandá un objeto JSON con una lista <code>tasks</code>; admite hasta 50 por llamada.</li>
                <li>El único campo obligatorio es <code>title</code>. Si omitís datos, la tarea entra en la Bandeja de entrada, área Personal, prioridad Media y 30 minutos.</li>
                <li>Incluí un <code>externalId</code> estable para que los reintentos actualicen la misma tarea en lugar de duplicarla.</li>
                <li>Las fechas usan <code>AAAA-MM-DD</code>. El máximo por solicitud es 100 KB.</li>
              </ul>
            </div>
            <pre className="api-example"><code>{example}</code></pre>
            <button className="outline-btn copy-example" onClick={() => void copy(example, 'example')}>
              {copied === 'example' ? <Check size={16}/> : <Copy size={16}/>} {copied === 'example' ? 'Ejemplo copiado' : 'Copiar ejemplo'}
            </button>
          </section>
          <p className="integration-footnote">
            No compartas la clave en código público ni la pongas en una app que se ejecute en el navegador. Guardala como secreto del servicio que envía las tareas.
          </p>
        </>
      )}
    </main>
  );
}
