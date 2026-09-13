import { Icon } from '../../components/ui/Icons'
import { Progress } from '../../components/ui'

export default function StatTile({ icon, label, value, sub, progress, tone = 'brand' }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600',
    gold: 'bg-gold-100 text-gold-700',
    emerald: 'bg-emerald-50 text-emerald-600',
    ink: 'bg-ink-100 text-ink-700',
  }
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-4 shadow-soft sm:p-5">
      <span className={`mb-3 inline-grid h-10 w-10 place-items-center rounded-2xl ${tones[tone]}`}>
        <Icon name={icon} size={19} />
      </span>
      <p className="font-display text-2xl font-extrabold leading-none text-ink-900">{value}</p>
      <p className="mt-1.5 text-xs font-semibold text-ink-500">{label}</p>
      {typeof progress === 'number' && <Progress value={progress} tone={progress > 85 ? 'danger' : tone === 'gold' ? 'gold' : 'brand'} className="mt-3" />}
      {sub && <p className="mt-2 text-[0.7rem] text-ink-400">{sub}</p>}
    </div>
  )
}
