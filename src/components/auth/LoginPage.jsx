import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { useStore } from '../../store/useStore'


export function LoginPage() {
  const { login, setView } = useStore()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-bg">
      <div className="w-full max-w-sm px-4 py-8">
        <div className="bg-surface-2 rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center space-y-1.5 pt-8 pb-5 px-8">
            {/* LOGO_PLACEHOLDER: вставьте сюда логотип */}
            <div className="w-12 h-12" />
            <div className="flex flex-col items-center space-y-0.5 text-center">
              <h1 className="text-2xl font-semibold text-fg-primary">С возвращением</h1>
              <p className="text-fg-muted text-sm">Войдите в аккаунт, чтобы продолжить</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-fg-primary">
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  autoComplete="email"
                  className="w-full border border-line rounded-lg px-3 py-2.5 text-sm text-fg-primary placeholder:text-fg-subtle bg-bg outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-fg-primary">
                Пароль
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Введите пароль"
                required
                autoComplete="current-password"
                className="w-full border border-line rounded-lg px-3 py-2.5 text-sm text-fg-primary placeholder:text-fg-subtle bg-bg outline-none focus:border-accent transition-colors"
              />
            </div>

            {error && (
              <div className="text-xs text-danger bg-danger-soft border border-danger/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? 'Вход...' : (<>Войти <ArrowRight size={16} /></>)}
            </button>
          </form>

          {/* Footer */}
          <div className="flex justify-center border-t border-line py-4">
            <p className="text-sm text-fg-muted">
              Нет аккаунта?{' '}
              <button
                type="button"
                onClick={() => setView('register')}
                className="text-accent font-medium hover:underline transition-colors"
              >
                Создать аккаунт
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
