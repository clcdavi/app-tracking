'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Target, Lock, Mail, User, ArrowRight, LoaderCircle } from 'lucide-react';
import { Toaster, toast } from 'sonner';

function LoginForm() {
  const searchParams = useSearchParams();
  const rawReturnTo = searchParams.get('return_to') || '/';
  // Strictly prevent Open Redirect: allow only local relative paths
  const returnTo = rawReturnTo.startsWith('/') && !rawReturnTo.startsWith('//') ? rawReturnTo : '/';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body =
        mode === 'login'
          ? { email, password }
          : { email, password, displayName };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || 'Ocurrió un error inesperado.');
      }

      toast.success(mode === 'login' ? '¡Bienvenido de vuelta!' : 'Cuenta creada con éxito.');
      window.location.href = returnTo;
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#e2e7f0] p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#315df5] text-white mb-4 shadow-sm">
          <Target size={24} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          enfoco<span className="text-[#315df5]">.</span>
        </h1>
        <p className="text-sm text-[#69768b] mt-1">
          {mode === 'login'
            ? 'Iniciá sesión en tu espacio de enfoque personal'
            : 'Configurá tu cuenta para empezar'}
        </p>
      </div>

      <div className="flex rounded-lg bg-[#f0f3f9] p-1 mb-6">
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
            mode === 'login'
              ? 'bg-white text-[#16233d] shadow-xs'
              : 'text-[#69768b] hover:text-[#16233d]'
          }`}
          onClick={() => {
            setMode('login');
            setError('');
          }}
        >
          Iniciar sesión
        </button>
        <button
          type="button"
          className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${
            mode === 'register'
              ? 'bg-white text-[#16233d] shadow-xs'
              : 'text-[#69768b] hover:text-[#16233d]'
          }`}
          onClick={() => {
            setMode('register');
            setError('');
          }}
        >
          Registrarse
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 p-3 rounded-lg bg-[#fff2ed] border border-[#f1c3b5] text-[#983d25] text-sm"
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'register' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#69768b] mb-1.5">
              Nombre
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8490a3]">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                placeholder="Tu nombre"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#dbe2ed] rounded-lg text-sm text-[#16233d] placeholder-[#9ca8bc] focus:outline-none focus:ring-2 focus:ring-[#315df5]"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#69768b] mb-1.5">
            Correo Electrónico
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8490a3]">
              <Mail size={18} />
            </span>
            <input
              type="email"
              required
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#dbe2ed] rounded-lg text-sm text-[#16233d] placeholder-[#9ca8bc] focus:outline-none focus:ring-2 focus:ring-[#315df5]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#69768b] mb-1.5">
            Contraseña
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8490a3]">
              <Lock size={18} />
            </span>
            <input
              type="password"
              required
              minLength={8}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 bg-white border border-[#dbe2ed] rounded-lg text-sm text-[#16233d] placeholder-[#9ca8bc] focus:outline-none focus:ring-2 focus:ring-[#315df5]"
            />
          </div>
          {mode === 'register' && (
            <p className="text-xs text-[#8490a3] mt-1">Mínimo 8 caracteres.</p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full mt-2 inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-[#315df5] hover:bg-[#244bd4] text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {busy ? (
            <>
              <LoaderCircle className="animate-spin" size={18} />
              <span>Procesando…</span>
            </>
          ) : (
            <>
              <span>{mode === 'login' ? 'Acceder a Enfoco' : 'Crear cuenta'}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-xs text-[#8490a3] mt-8">
        Enfoco · Datos seguros con PostgreSQL en tu propia infraestructura.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#f4f6fa] text-[#16233d]">
      <Suspense fallback={<div className="p-8 text-center text-[#69768b]">Cargando…</div>}>
        <LoginForm />
      </Suspense>
      <Toaster position="bottom-right" richColors closeButton />
    </main>
  );
}
