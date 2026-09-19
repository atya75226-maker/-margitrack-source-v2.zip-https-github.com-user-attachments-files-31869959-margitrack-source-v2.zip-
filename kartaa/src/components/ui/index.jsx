import { forwardRef, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icons'
import { useToast } from '../../state/ToastContext'

/* --------------------------------------------------------------- boutons */

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 shadow-soft disabled:bg-brand-300',
  dark: 'bg-ink-900 text-white hover:bg-ink-800 shadow-soft disabled:bg-ink-400',
  gold: 'bg-gold-400 text-ink-900 hover:bg-gold-300 shadow-soft',
  soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  outline: 'border border-ink-200 bg-white text-ink-800 hover:border-ink-300 hover:bg-ink-50',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
  dangerSoft: 'bg-rose-50 text-rose-700 hover:bg-rose-100',
  // Posés sur un fond sombre : bandeaux de mise à jour et d'installation.
  light: 'bg-white text-ink-900 hover:bg-ink-100 shadow-soft',
  ghostLight: 'text-white/80 hover:bg-white/10 hover:text-white',
}

const SIZES = {
  sm: 'h-9 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-5 text-[0.95rem] rounded-2xl gap-2',
  lg: 'h-[3.25rem] px-6 text-base rounded-2xl gap-2.5',
}

export const Button = forwardRef(function Button(
  { as: Tag = 'button', variant = 'primary', size = 'md', icon, iconRight, full, loading, className = '', children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={`inline-flex select-none items-center justify-center font-semibold transition-all duration-150 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-70 ${VARIANTS[variant]} ${SIZES[size]} ${full ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading ? <Spinner size={16} /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === 'sm' ? 16 : 18} /> : null}
    </Tag>
  )
})

export function IconButton({ icon, label, variant = 'ghost', size = 18, className = '', ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  )
}

export function Spinner({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`animate-spin ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" fill="none" opacity=".25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------------ formulaires */

export function Field({ label, hint, error, required, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="field-label">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1.5 block text-xs font-medium text-rose-600">{error}</span> : hint ? <span className="mt-1.5 block hint">{hint}</span> : null}
    </label>
  )
}

const inputClass =
  'w-full rounded-2xl border border-ink-200 bg-white px-4 py-3 text-ink-900 placeholder:text-ink-300 outline-none transition-all focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-ink-50'

export const Input = forwardRef(function Input({ className = '', icon, ...rest }, ref) {
  if (icon) {
    return (
      <span className="relative block">
        <Icon name={icon} size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-300" />
        <input ref={ref} className={`${inputClass} pl-11 ${className}`} {...rest} />
      </span>
    )
  }
  return <input ref={ref} className={`${inputClass} ${className}`} {...rest} />
})

export function Textarea({ className = '', rows = 4, ...rest }) {
  return <textarea rows={rows} className={`${inputClass} resize-y leading-relaxed ${className}`} {...rest} />
}

export function Select({ className = '', children, ...rest }) {
  return (
    <span className="relative block">
      <select className={`${inputClass} appearance-none pr-11 ${className}`} {...rest}>
        {children}
      </select>
      <Icon name="chevronDown" size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-400" />
    </span>
  )
}

export function PasswordInput({ className = '', ...rest }) {
  const [visible, setVisible] = useState(false)
  return (
    <span className="relative block">
      <input type={visible ? 'text' : 'password'} className={`${inputClass} pr-12 ${className}`} {...rest} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Masquer' : 'Afficher'}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </span>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 text-left disabled:opacity-50"
    >
      <span className="min-w-0">
        {label && <span className="block text-sm font-semibold text-ink-800">{label}</span>}
        {description && <span className="mt-0.5 block hint">{description}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-600' : 'bg-ink-200'}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </span>
    </button>
  )
}

/* ---------------------------------------------------------------- surfaces */

export function Panel({ className = '', children, ...rest }) {
  return (
    <section className={`surface p-5 sm:p-6 ${className}`} {...rest}>
      {children}
    </section>
  )
}

export function SectionTitle({ title, subtitle, action, icon, className = '' }) {
  return (
    <div className={`mb-4 flex flex-col items-start gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
          {icon && <Icon name={icon} size={20} className="text-brand-600" />}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function Badge({ tone = 'neutral', icon, children, className = '' }) {
  const tones = {
    neutral: 'bg-ink-100 text-ink-600',
    brand: 'bg-brand-50 text-brand-700',
    gold: 'bg-gold-100 text-gold-700',
    success: 'bg-emerald-50 text-emerald-700',
    danger: 'bg-rose-50 text-rose-700',
    dark: 'bg-ink-900 text-white',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${tones[tone]} ${className}`}>
      {icon && <Icon name={icon} size={13} />}
      {children}
    </span>
  )
}

export function EmptyState({ icon = 'sparkles', title, description, action, className = '' }) {
  return (
    <div className={`flex flex-col items-center rounded-3xl border border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center ${className}`}>
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon name={icon} size={26} />
      </span>
      <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
      {description && <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Progress({ value = 0, tone = 'brand', className = '' }) {
  const tones = { brand: 'bg-brand-600', gold: 'bg-gold-400', danger: 'bg-rose-500', success: 'bg-emerald-500' }
  return (
    <span className={`block h-2 w-full overflow-hidden rounded-full bg-ink-100 ${className}`}>
      <span className={`block h-full rounded-full transition-all duration-500 ${tones[tone]}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </span>
  )
}

export function Avatar({ src, initials = '?', size = 48, className = '', ring = false }) {
  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-brand-100 font-display font-bold text-brand-700 ${ring ? 'ring-4 ring-white' : ''} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : initials}
    </span>
  )
}

/* ----------------------------------------------------------------- modale */

export function Modal({ open, onClose, title, description, children, footer, size = 'md', closable = true }) {
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape' && closable) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose, closable])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink-950/55 backdrop-blur-sm" onClick={() => closable && onClose?.()} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-lift animate-scale-in sm:rounded-3xl ${sizes[size]}`}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
          </div>
          {closable && <IconButton icon="x" label="Fermer" onClick={onClose} />}
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
        {footer && <div className="sticky bottom-0 border-t border-ink-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({ open, onClose, onConfirm, title, description, confirmLabel = 'Confirmer', tone = 'danger' }) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" full onClick={onClose}>
            Annuler
          </Button>
          <Button
            variant={tone}
            full
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
                onClose?.()
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="text-sm leading-relaxed text-ink-600">Cette action est définitive.</p>
    </Modal>
  )
}

/* ---------------------------------------------------------------- divers */

export function Stepper({ steps, current, onSelect }) {
  return (
    <ol className="flex items-center gap-1.5">
      {steps.map((step, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={step} className="flex flex-1 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSelect && index <= current && onSelect(index)}
              className="group flex flex-1 flex-col gap-1.5"
              aria-current={active ? 'step' : undefined}
            >
              <span className={`h-1.5 w-full rounded-full transition-colors ${done || active ? 'bg-brand-600' : 'bg-ink-200'}`} />
              <span className={`truncate text-[0.7rem] font-bold uppercase tracking-wide ${active ? 'text-brand-700' : 'text-ink-400'}`}>
                {step}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-ink-100 p-1 ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition-all ${
            value === tab.id ? 'bg-white text-ink-900 shadow-soft' : 'text-ink-500 hover:text-ink-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** Zone de dépôt de fichiers, utilisée pour les images des cartes. */
export function FileDrop({ onFiles, accept, multiple = true, label = 'Déposez vos fichiers ici', hint, icon = 'upload', disabled }) {
  const inputRef = useRef(null)
  const [over, setOver] = useState(false)
  const id = useId()

  const handle = (list) => {
    const files = Array.from(list || []).filter(Boolean)
    if (files.length) onFiles(files)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        if (!disabled) handle(event.dataTransfer.files)
      }}
      className={`rounded-3xl border-2 border-dashed p-6 text-center transition-colors ${
        over ? 'border-brand-400 bg-brand-50' : 'border-ink-200 bg-ink-50/60'
      } ${disabled ? 'opacity-60' : ''}`}
    >
      <input
        id={id}
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          handle(event.target.files)
          event.target.value = ''
        }}
      />
      <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white text-brand-600 shadow-soft">
        <Icon name={icon} size={22} />
      </span>
      <p className="text-sm font-semibold text-ink-800">{label}</p>
      {hint && <p className="mx-auto mt-1 max-w-xs hint">{hint}</p>}
      <Button type="button" size="sm" variant="outline" className="mt-4" disabled={disabled} onClick={() => inputRef.current?.click()}>
        Parcourir
      </Button>
    </div>
  )
}

export function Toaster() {
  const { toasts, dismiss } = useToast()
  if (!toasts.length) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {toasts.map((toast) => {
        const tones = {
          default: 'bg-ink-900 text-white',
          success: 'bg-emerald-600 text-white',
          error: 'bg-rose-600 text-white',
        }
        const icons = { default: 'info', success: 'check', error: 'alert' }
        return (
          <button
            key={toast.id}
            type="button"
            onClick={() => dismiss(toast.id)}
            className={`pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lift animate-fade-up ${tones[toast.tone] || tones.default}`}
          >
            <Icon name={icons[toast.tone] || 'info'} size={17} />
            <span className="text-left">{toast.message}</span>
          </button>
        )
      })}
    </div>,
    document.body,
  )
}
