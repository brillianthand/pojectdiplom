import { useState } from 'react'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useStore } from '../../store/useStore'


export function RegisterPage() {
  const { register, setView } = useStore()
  const [name, setName]                 = useState('')
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)

  const passwordOk    = password.length >= 6
  const passwordsMatch = confirm.length > 0 && password === confirm

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!passwordOk) {
      setError('Пароль должен содержать минимум 6 символов')
      return
    }
    if (password !== confirm) {
      setError('Пароли не совпадают')
      return
    }
    setError('')
    setLoading(true)
    try {
      await register(email, password, name)
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
              <h2 className="text-2xl font-semibold text-fg-primary">Создать аккаунт</h2>
              <p className="text-fg-muted text-sm">Добро пожаловать! Начните прямо сейчас.</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-6 space-y-4">
            {/* Имя */}
            <div className="space-y-1.5">
              <label htmlFor="reg-name" className="block text-sm font-medium text-fg-primary">Имя</label>
              <div className="relative">
                <input
                  id="reg-name"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Иван Иванов"
                  required
                  autoComplete="name"
                  className="w-full border border-line rounded-lg px-3 py-2.5 text-sm text-fg-primary placeholder:text-fg-subtle bg-bg outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="reg-email" className="block text-sm font-medium text-fg-primary">Email</label>
              <div className="relative">
                <input
                  id="reg-email"
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

            {/* Пароль */}
            <div className="space-y-1.5">
              <label htmlFor="reg-password" className="block text-sm font-medium text-fg-primary">Пароль</label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  required
                  autoComplete="new-password"
                  className="w-full border border-line rounded-lg pl-3 pr-10 py-2.5 text-sm text-fg-primary placeholder:text-fg-subtle bg-bg outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-fg-muted hover:text-fg-primary transition-colors"
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {password && (
                <p className={`text-xs ${passwordOk ? 'text-success' : 'text-fg-muted'}`}>
                  {passwordOk ? '✓ Длина пароля достаточна' : `Ещё ${6 - password.length} симв.`}
                </p>
              )}
            </div>

            {/* Подтверждение пароля */}
            <div className="space-y-1.5">
              <label htmlFor="reg-confirm" className="block text-sm font-medium text-fg-primary">Подтвердить пароль</label>
              <div className="relative">
                <input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Повторите пароль"
                  required
                  autoComplete="new-password"
                  className="w-full border border-line rounded-lg pl-3 pr-10 py-2.5 text-sm text-fg-primary placeholder:text-fg-subtle bg-bg outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-fg-muted hover:text-fg-primary transition-colors"
                  aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirm && (
                <p className={`text-xs ${passwordsMatch ? 'text-success' : 'text-danger'}`}>
                  {passwordsMatch ? '✓ Пароли совпадают' : 'Пароли не совпадают'}
                </p>
              )}
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
              {loading ? 'Создание...' : (<>Создать аккаунт <ArrowRight size={16} /></>)}
            </button>
          </form>

          {/* Footer */}
          <div className="flex justify-center border-t border-line py-4">
            <p className="text-sm text-fg-muted">
              Уже есть аккаунт?{' '}
              <button
                type="button"
                onClick={() => setView('login')}
                className="text-accent font-medium hover:underline transition-colors"
              >
                Войти
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
