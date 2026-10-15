import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { AlertTriangle, MapPin, Package } from 'lucide-react'
import type { UrgencyLevel } from '@/types'
import { cn } from '@/utils/cn'
import { urgencyLabel, urgencyBadgeClasses } from '@/utils/urgency'

const CATEGORIES = ['Water', 'Food', 'Medical', 'Shelter', 'Hygiene', 'Clothing', 'Other']
const URGENCY_OPTIONS: UrgencyLevel[] = ['low', 'medium', 'high', 'critical']

interface FormState {
  title:       string
  description: string
  location:    string
  category:    string
  urgency:     UrgencyLevel
  quantity:    string
  unit:        string
}

const INITIAL: FormState = {
  title:       '',
  description: '',
  location:    '',
  category:    'Water',
  urgency:     'medium',
  quantity:    '',
  unit:        'units',
}

export function CreatePage() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Partial<FormState>>({})

  const set = (key: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const validate = (): boolean => {
    const e: Partial<FormState> = {}
    if (!form.title.trim())    e.title    = 'Title is required'
    if (!form.location.trim()) e.location = 'Location is required'
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) < 1)
      e.quantity = 'Enter a valid quantity (≥ 1)'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    // TODO: POST to Supabase
    await new Promise(r => setTimeout(r, 800))
    setSubmitted(true)
  }

  return (
    <AppShell>
      <TopBar title="Create Request" showBack variant="navy" />

      <div className="pt-16 px-4 pb-6">
        {submitted ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-success-bg flex items-center justify-center">
              <Package className="w-8 h-8 text-success" />
            </div>
            <div>
              <h2 className="text-h2 font-semibold text-ink mb-1">Request submitted!</h2>
              <p className="text-caption text-ink-muted">Your supply request has been posted to the ReliefLink network.</p>
            </div>
            <Button variant="secondary" onClick={() => { setForm(INITIAL); setSubmitted(false) }}>
              Create another
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">

            {/* Urgency selector */}
            <div className="flex flex-col gap-2">
              <label className="text-caption font-semibold text-ink">Urgency level</label>
              <div className="flex gap-2 flex-wrap">
                {URGENCY_OPTIONS.map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => set('urgency', u)}
                    className={cn(
                      'px-3 py-1.5 rounded-pill border text-caption font-medium transition-all',
                      form.urgency === u
                        ? urgencyBadgeClasses[u] + ' font-semibold'
                        : 'bg-surface-high text-on-surface-muted border-slate-200',
                    )}
                  >
                    {urgencyLabel[u]}
                  </button>
                ))}
              </div>
            </div>

            <Input
              label="Request title *"
              placeholder="e.g. Drinking water for 200 families"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              error={errors.title}
            />

            <Textarea
              label="Description"
              placeholder="Add context: affected population, health risk, deadline…"
              rows={3}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />

            <Input
              label="Location *"
              placeholder="e.g. Kothrud, Pune"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              error={errors.location}
              leftIcon={<MapPin className="w-4 h-4" />}
            />

            {/* Category */}
            <div className="flex flex-col gap-2">
              <label className="text-caption font-semibold text-ink">Category</label>
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set('category', cat)}
                    className={cn(
                      'h-9 px-3.5 rounded-pill text-caption font-medium border transition-all',
                      form.category === cat
                        ? 'bg-navy-900 text-white border-navy-900'
                        : 'bg-surface-high text-on-surface-muted border-slate-200 hover:text-ink',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity + unit */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Quantity needed *"
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="e.g. 200"
                value={form.quantity}
                onChange={e => set('quantity', e.target.value)}
                error={errors.quantity}
              />
              <Input
                label="Unit"
                placeholder="bottles, kits, kg…"
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
              />
            </div>

            {/* Critical warning */}
            {form.urgency === 'critical' && (
              <div className="bg-danger-bg border border-red-200 rounded-card p-3 flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
                <p className="text-caption text-danger leading-relaxed">
                  Marking as Critical triggers immediate alerts to all nearby donors. Use only for life-threatening situations.
                </p>
              </div>
            )}

            <Button type="submit" variant="primary" fullWidth size="lg">
              Submit Request
            </Button>
          </form>
        )}
      </div>
    </AppShell>
  )
}
