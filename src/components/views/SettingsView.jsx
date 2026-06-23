import { useRef, useState } from 'react'
import { User, Lock, LogOut, Check, Camera, Trash2, Loader2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { Avatar } from '../ui/Avatar'

const TABS = [
  { id: 'profile',  Icon: User, label: 'Профиль' },
  { id: 'security', Icon: Lock, label: 'Безопасность' },
]

const MAX_FILE_BYTES = 8 * 1024 * 1024
const OUTPUT_SIZE = 256

// Resize/crop an image File to a square JPEG data URL via canvas.
async function fileToAvatarDataUrl(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'))
    reader.readAsDataURL(file)
  })

  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error('Не удалось декодировать изображение'))
    el.src = dataUrl
  })

  const side = Math.min(img.width, img.height)
  const sx = (img.width  - side) / 2
  const sy = (img.height - side) / 2

  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
  return canvas.toDataURL('image/jpeg', 0.9)
}

function ProfileTab() {
  const currentUser   = useStore(s => s.currentUser)
  const updateProfile = useStore(s => s.updateProfile)
  const setApiError   = useStore(s => s.setApiError)

  const [name, setName]           = useState(currentUser?.name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef(null)

  const trimmedName = name.trim()
  const dirty = trimmedName !== currentUser?.name
  const valid = trimmedName.length > 0 && trimmedName.length <= 64

  const persist = async (next) => {
    if (savingProfile) return
    setSavingProfile(true)
    try {
      await updateProfile({
        name: next.name ?? trimmedName,
        avatarUrl: next.avatarUrl ?? avatarUrl,
      })
      setSavedAt(Date.now())
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSavingProfile(false)
    }
  }

  const onSaveName = () => {
    if (!dirty || !valid) return
    persist({ name: trimmedName })
  }

  const onPickFile = () => {
    setUploadError('')
    fileInputRef.current?.click()
  }

  const onFileChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setUploadError('Поддерживаются только изображения')
      return
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError('Файл слишком большой — макс. 8 МБ')
      return
    }
    setUploading(true)
    setUploadError('')
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      setAvatarUrl(dataUrl)
      await persist({ avatarUrl: dataUrl })
    } catch (err) {
      setUploadError(err.message || 'Не удалось обработать изображение')
    } finally {
      setUploading(false)
    }
  }

  const onRemoveAvatar = async () => {
    if (uploading || !avatarUrl) return
    setUploading(true)
    setUploadError('')
    try {
      setAvatarUrl('')
      await persist({ avatarUrl: '' })
    } catch (err) {
      setUploadError(err.message || 'Не удалось удалить фото')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="flex flex-col gap-10">
      <header>
        <h2 className="text-xl font-display-tight text-fg-primary">Профиль</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Эти данные видят другие участники в задачах, комментариях и списках.
        </p>
      </header>

      {/* Avatar — clickable, with hover overlay */}
      <div className="flex items-center gap-6">
        <button
          type="button"
          onClick={onPickFile}
          disabled={uploading}
          className="group relative w-24 h-24 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
          aria-label="Загрузить фото профиля"
        >
          <Avatar
            size="xl"
            avatarUrl={avatarUrl}
            color={currentUser?.color}
            initials={currentUser?.initials ?? '?'}
            className="w-24 h-24 text-3xl"
          />
          <span
            className={`absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55 text-white text-[11px] font-medium tracking-wide transition-opacity ${
              uploading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
          >
            {uploading
              ? <Loader2 size={20} className="animate-spin" />
              : <><Camera size={18} strokeWidth={1.8} /><span>Изменить</span></>
            }
          </span>
        </button>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPickFile}
              disabled={uploading}
              className="h-9 px-3.5 rounded-md border border-line text-sm text-fg-primary hover:bg-surface-2 disabled:opacity-50 inline-flex items-center gap-2 transition-colors"
            >
              <Camera size={14} strokeWidth={1.8} />
              {avatarUrl ? 'Заменить фото' : 'Загрузить фото'}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={onRemoveAvatar}
                disabled={uploading}
                className="h-9 px-3 rounded-md text-sm text-fg-muted hover:text-danger disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={14} strokeWidth={1.8} />
                Удалить
              </button>
            )}
          </div>
          <p className="text-xs text-fg-subtle">
            JPG, PNG или WebP. До 8 МБ. Изображение будет обрезано до квадрата.
          </p>
          {uploadError && <p className="text-xs text-danger">{uploadError}</p>}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={onFileChange}
          className="hidden"
        />
      </div>

      {/* Name */}
      <div className="flex flex-col gap-2 max-w-md">
        <label className="text-xs font-mono uppercase tracking-[0.14em] text-fg-muted">Имя</label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={80}
          className="h-10 px-3 bg-surface-2 border border-line rounded-md text-sm text-fg-primary outline-none focus:border-line-accent transition-colors"
          placeholder="Ваше имя"
        />
        {!valid && trimmedName.length === 0 && (
          <span className="text-xs text-danger">Имя обязательно</span>
        )}
        {trimmedName.length > 64 && (
          <span className="text-xs text-danger">Имя слишком длинное (макс. 64 символа)</span>
        )}
      </div>

      {/* Email (read-only) */}
      <div className="flex flex-col gap-2 max-w-md">
        <label className="text-xs font-mono uppercase tracking-[0.14em] text-fg-muted">Email</label>
        <input
          value={currentUser?.email ?? ''}
          readOnly
          className="h-10 px-3 bg-surface-1 border border-line rounded-md text-sm text-fg-muted cursor-not-allowed"
        />
        <span className="text-xs text-fg-subtle">Email используется как логин и пока не редактируется.</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onSaveName}
          disabled={!dirty || !valid || savingProfile}
          className="h-10 px-5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {savingProfile ? 'Сохранение…' : 'Сохранить'}
        </button>
        {savedAt > 0 && !dirty && !uploading && (
          <span className="text-xs text-fg-muted flex items-center gap-1">
            <Check size={12} /> Сохранено
          </span>
        )}
      </div>
    </section>
  )
}

function SecurityTab() {
  const logout         = useStore(s => s.logout)
  const changePassword = useStore(s => s.changePassword)
  const setApiError    = useStore(s => s.setApiError)

  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [doneAt, setDoneAt] = useState(0)

  const tooShort   = newPassword.length > 0 && newPassword.length < 8
  const mismatch   = confirm.length > 0 && confirm !== newPassword
  const canSubmit  = oldPassword.length > 0 && newPassword.length >= 8 && confirm === newPassword && !saving

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      await changePassword({ oldPassword, newPassword })
      setOldPassword('')
      setNewPassword('')
      setConfirm('')
      setDoneAt(Date.now())
    } catch (err) {
      setApiError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-10">
      <div>
        <header className="mb-6">
          <h2 className="text-xl font-display-tight text-fg-primary">Безопасность</h2>
          <p className="mt-1 text-sm text-fg-muted">
            Смена пароля и управление сессией.
          </p>
        </header>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 max-w-md">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono uppercase tracking-[0.14em] text-fg-muted">Текущий пароль</label>
            <input
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              autoComplete="current-password"
              className="h-10 px-3 bg-surface-2 border border-line rounded-md text-sm text-fg-primary outline-none focus:border-line-accent transition-colors"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono uppercase tracking-[0.14em] text-fg-muted">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="h-10 px-3 bg-surface-2 border border-line rounded-md text-sm text-fg-primary outline-none focus:border-line-accent transition-colors"
            />
            {tooShort && <span className="text-xs text-danger">Минимум 8 символов</span>}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono uppercase tracking-[0.14em] text-fg-muted">Подтверждение</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="h-10 px-3 bg-surface-2 border border-line rounded-md text-sm text-fg-primary outline-none focus:border-line-accent transition-colors"
            />
            {mismatch && <span className="text-xs text-danger">Пароли не совпадают</span>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-10 px-5 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Сохранение…' : 'Сменить пароль'}
            </button>
            {doneAt > 0 && (
              <span className="text-xs text-fg-muted flex items-center gap-1">
                <Check size={12} /> Пароль обновлён
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="pt-8 border-t border-line">
        <h3 className="text-sm font-medium text-fg-primary mb-1">Завершить сеанс</h3>
        <p className="text-xs text-fg-muted mb-4">
          Выйдет из аккаунта на этом устройстве. Чтобы войти снова, потребуется email и пароль.
        </p>
        <button
          onClick={logout}
          className="h-9 px-4 rounded-md border border-line hover:border-danger hover:text-danger text-sm text-fg-secondary inline-flex items-center gap-2 transition-colors"
        >
          <LogOut size={14} />
          Выйти из аккаунта
        </button>
      </div>
    </section>
  )
}

export function SettingsView() {
  const [tab, setTab] = useState('profile')

  return (
    <div className="flex-1 overflow-auto bg-bg">
      <div className="max-w-[1100px] mx-auto px-8 py-10 flex flex-col gap-10">
        <header>
          <p className="text-xs font-mono uppercase tracking-[0.18em] text-fg-muted">Аккаунт</p>
          <h1 className="text-4xl font-display-tight text-fg-primary leading-[0.95] mt-2">
            Настройки
          </h1>
        </header>

        <div className="grid grid-cols-[200px_1fr] gap-12">
          {/* Tabs */}
          <nav className="flex flex-col gap-1">
            {TABS.map(({ id, Icon, label }) => {
              const active = tab === id
              return (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? 'bg-surface-3 text-fg-primary font-medium'
                      : 'text-fg-secondary hover:text-fg-primary hover:bg-surface-2'
                  }`}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  {label}
                </button>
              )
            })}
          </nav>

          {/* Content */}
          <div className="min-w-0">
            {tab === 'profile'  && <ProfileTab />}
            {tab === 'security' && <SecurityTab />}
          </div>
        </div>
      </div>
    </div>
  )
}
