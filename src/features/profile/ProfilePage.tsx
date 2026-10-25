import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TopBar } from '@/components/layout/TopBar'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Toast } from '@/components/ui/Toast'
import { StatusBadge } from '@/components/ui/Badge'
import { PushNotificationSettings } from '@/components/notifications/PushNotificationSettings'
import { LocationPickerModal, reverseGeocodeNominatim } from '@/components/LocationPickerModal'
import { LogOut, User, MapPin, Mail, Shield, Sparkles, ArrowRight, Lock, CheckCircle2, Phone, Save, Navigation } from 'lucide-react'

export function ProfilePage() {
  const { user, upgradeAccount, signOut, updateContactPhone, updateLocation } = useAuth()
  const navigate = useNavigate()

  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)
  const [upgradeEmail, setUpgradeEmail] = useState('')
  const [upgradePassword, setUpgradePassword] = useState('')
  const [isUpgrading, setIsUpgrading] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const [upgradeSuccessEmail, setUpgradeSuccessEmail] = useState<string | null>(null)

  // Location state
  const [locationInput, setLocationInput] = useState(user?.location || '')
  const [isSavingLocation, setIsSavingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [locationSaved, setLocationSaved] = useState(false)
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false)
  const [isLocating, setIsLocating] = useState(false)

  // Contact number state
  const [phoneInput, setPhoneInput] = useState(user?.phone || '')
  const [isSavingPhone, setIsSavingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneSaved, setPhoneSaved] = useState(false)

  useEffect(() => {
    if (user?.phone) {
      setPhoneInput(user.phone)
    }
  }, [user?.phone])

  useEffect(() => {
    if (user?.location) {
      setLocationInput(user.location)
    }
  }, [user?.location])

  if (!user) return null

  const isAnonymous = Boolean(user.is_anonymous)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const handleUseCurrentLocation = () => {
    setLocationError(null)
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        try {
          const address = await reverseGeocodeNominatim(lat, lng, true)
          if (address) {
            setLocationInput(address)
            setLocationError(null)
          }
        } catch {
          showToast('Coordinates retrieved. Please type your city or address manually.')
        } finally {
          setIsLocating(false)
        }
      },
      (err) => {
        setIsLocating(false)
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location access denied. Please choose on map or type manually.')
        } else {
          setLocationError('Could not retrieve current location. Please choose on map or type manually.')
        }
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleMapConfirm = (address: string) => {
    if (address) {
      setLocationInput(address)
      setLocationError(null)
    }
    setIsMapPickerOpen(false)
  }

  const handleSaveLocation = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocationError(null)
    setLocationSaved(false)

    const trimmed = locationInput.trim()
    setIsSavingLocation(true)
    const { error } = await updateLocation(trimmed)
    setIsSavingLocation(false)

    if (error) {
      setLocationError(error.message || 'Failed to save location')
    } else {
      setLocationSaved(true)
      showToast(trimmed ? 'Location saved to your profile' : 'Location cleared')
      setTimeout(() => setLocationSaved(false), 3000)
    }
  }

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault()
    setPhoneError(null)
    setPhoneSaved(false)

    const trimmed = phoneInput.trim()
    if (trimmed) {
      const cleanDigits = trimmed.replace(/\D/g, '')
      if (cleanDigits.length < 7) {
        setPhoneError('Please enter a valid phone number with at least 7 digits')
        return
      }
    }

    setIsSavingPhone(true)
    const { error } = await updateContactPhone(trimmed)
    setIsSavingPhone(false)

    if (error) {
      setPhoneError(error.message || 'Failed to save contact number')
    } else {
      setPhoneSaved(true)
      showToast(trimmed ? 'Contact number saved to your profile' : 'Contact number cleared')
      setTimeout(() => setPhoneSaved(false), 3000)
    }
  }

  const handleUpgradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setUpgradeError(null)

    const trimmed = upgradeEmail.trim()
    if (!trimmed) {
      setUpgradeError('Please enter a valid email address')
      return
    }
    if (upgradePassword.length < 6) {
      setUpgradeError('Password must be at least 6 characters')
      return
    }

    setIsUpgrading(true)
    const { error } = await upgradeAccount(trimmed, upgradePassword)
    setIsUpgrading(false)

    if (error) {
      setUpgradeError(error.message || 'Failed to save account. Please try again.')
    } else {
      setUpgradeSuccessEmail(trimmed)
      showToast(`Account saved! Verification link sent to ${trimmed}`)
    }
  }

  const STATS = [
    { label: 'Offers made',   value: 12 },
    { label: 'Kg delivered',  value: 480 },
    { label: 'Requests aided', value: 7 },
  ]

  return (
    <AppShell>
      <TopBar title="Profile" variant="navy" />

      <div className="pt-16 pb-12 space-y-4 max-w-lg mx-auto w-full min-w-0">
        {/* ── Guest Warning / Save Data Banner ── */}
        {isAnonymous && (
          <Card className="p-5 border border-brand-200 bg-brand-50/50 shadow-card flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-body font-bold text-navy-900 leading-snug">
                  Save your data
                </h3>
                <p className="text-caption text-ink-muted mt-1 leading-relaxed">
                  You are using a temporary guest account. Save your data to access it on other devices.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                className="flex-1"
                onClick={() => {
                  setUpgradeError(null)
                  setIsUpgradeModalOpen(true)
                }}
              >
                Save my account
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 text-ink-muted hover:text-navy-900"
                onClick={() => navigate('/login')}
              >
                I already have an account
              </Button>
            </div>
          </Card>
        )}

        {/* Avatar + name card */}
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card p-5 flex flex-col items-center gap-3 text-center">
          <div className="w-20 h-20 rounded-full bg-navy-900 flex items-center justify-center text-white text-h1 font-bold">
            {user.avatarInitials}
          </div>
          <div>
            <h2 className="text-h2 font-semibold text-ink">{user.name}</h2>
            <p className="text-caption text-ink-muted mt-0.5">
              {isAnonymous ? 'Temporary Guest Session' : user.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={isAnonymous ? 'pending' : 'accepted'} />
            <span className="text-caption text-ink-muted capitalize">
              {isAnonymous ? 'Guest' : user.role}
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {STATS.map(s => (
            <div key={s.label} className="bg-surface rounded-card border border-slate-200/80 shadow-card p-3 text-center">
              <p className="text-h2 font-semibold text-ink tnum">{s.value}</p>
              <p className="text-[11px] font-medium text-ink-muted mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Info items */}
        <div className="bg-surface rounded-card border border-slate-200/80 shadow-card overflow-hidden">
          {[
            {
              Icon: Mail,
              label: 'Email',
              value: isAnonymous ? 'Not registered (Guest)' : user.email,
            },
            {
              Icon: Phone,
              label: 'Saved Contact',
              value: user.phone || 'Not provided',
            },
            { Icon: MapPin, label: 'Location', value: user.location || 'Not set' },
            { Icon: Shield, label: 'Account Type', value: isAnonymous ? 'Guest (Unsaved)' : 'Verified Member' },
            { Icon: User, label: 'Member since', value: new Date(user.createdAt).getFullYear().toString() },
          ].map(({ Icon, label, value }, i, arr) => (
            <div
              key={label}
              className={`flex items-center gap-3 p-4 min-h-[56px] ${i < arr.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-brand-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">{label}</p>
                <p className="text-body font-medium text-ink truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Location Management Card */}
        <Card className="p-5 border border-slate-200/80 shadow-card flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-body font-bold text-navy-900 leading-snug">
                  Your Location
                </h3>
                {user.location && (
                  <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-pill">
                    Saved in profile
                  </span>
                )}
              </div>
              <p className="text-caption text-ink-muted mt-1 leading-relaxed">
                Set your primary city or neighborhood to view nearby relief needs and prefill dispatch forms.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveLocation} className="flex flex-col gap-3 pt-1">
            <Input
              id="profile-location-input"
              label="City or Address"
              type="text"
              placeholder="e.g. Chennai, Tamil Nadu"
              value={locationInput}
              onChange={e => {
                setLocationInput(e.target.value)
                if (locationError) setLocationError(null)
              }}
              error={locationError || undefined}
              leftIcon={<MapPin className="w-4 h-4" />}
            />

            {/* Location helper buttons */}
            <div className="grid grid-cols-2 gap-2.5 -mt-0.5">
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={isLocating}
                className="h-10 px-3 rounded-input border border-slate-200 bg-surface hover:bg-slate-50 text-ink text-caption font-medium flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:scale-[0.99] disabled:opacity-50"
              >
                <Navigation className="w-4 h-4 text-brand-600 shrink-0" />
                <span className="truncate">{isLocating ? 'Locating...' : '📍 Use my location'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsMapPickerOpen(true)}
                className="h-10 px-3 rounded-input border border-slate-200 bg-surface hover:bg-slate-50 text-ink text-caption font-medium flex items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 active:scale-[0.99]"
              >
                <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
                <span className="truncate">🗺️ Choose on map</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSavingLocation}
                leftIcon={<Save className="w-3.5 h-3.5" />}
              >
                Save Location
              </Button>

              {locationSaved && (
                <span className="text-caption text-success font-medium flex items-center gap-1 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved!
                </span>
              )}
            </div>
          </form>
        </Card>

        {/* Contact Phone Management Card */}
        <Card className="p-5 border border-slate-200/80 shadow-card flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center shrink-0 mt-0.5">
              <Phone className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-body font-bold text-navy-900 leading-snug">
                  Contact Number
                </h3>
                {user.phone && (
                  <span className="text-[11px] font-semibold text-brand-600 bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-pill">
                    Saved in profile
                  </span>
                )}
              </div>
              <p className="text-caption text-ink-muted mt-1 leading-relaxed">
                Your contact number is kept private and never shown publicly on your profile. It is used to prefill logistics forms, and you choose whether to enable direct calls.
              </p>
            </div>
          </div>

          <form onSubmit={handleSavePhone} className="flex flex-col gap-3 pt-1">
            <Input
              id="profile-phone-input"
              label="Phone / Mobile Number"
              type="tel"
              inputMode="tel"
              placeholder="e.g. +91 98765 43210"
              value={phoneInput}
              onChange={e => {
                setPhoneInput(e.target.value)
                if (phoneError) setPhoneError(null)
              }}
              error={phoneError || undefined}
            />

            <div className="flex items-center justify-between gap-2">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSavingPhone}
                leftIcon={<Save className="w-3.5 h-3.5" />}
              >
                Save Contact Number
              </Button>

              {phoneSaved && (
                <span className="text-caption text-success font-medium flex items-center gap-1 animate-in fade-in duration-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Saved!
                </span>
              )}
            </div>
          </form>
        </Card>

        {/* Push Notification Preferences */}
        <PushNotificationSettings />

        {/* Sign out */}
        <Button
          variant="secondary"
          fullWidth
          leftIcon={<LogOut className="w-4 h-4" />}
          onClick={signOut}
        >
          Sign Out
        </Button>
      </div>

      {/* ── Save Account / Upgrade Modal ── */}
      <Modal
        isOpen={isUpgradeModalOpen}
        onClose={() => {
          setIsUpgradeModalOpen(false)
          setUpgradeSuccessEmail(null)
          setUpgradeEmail('')
          setUpgradePassword('')
        }}
        title={upgradeSuccessEmail ? 'Verification Email Sent' : 'Save Your Account'}
        maxWidth="max-w-md"
      >
        {upgradeSuccessEmail ? (
          <div className="py-2 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 text-success flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-7 h-7 text-success" />
            </div>

            <div>
              <h3 className="text-h3 font-semibold text-navy-900">Check your email</h3>
              <p className="text-caption text-ink-muted mt-1.5">
                We sent a confirmation link to:
              </p>
              <div className="mt-2">
                <span className="font-mono text-caption font-semibold text-navy-900 bg-brand-50 border border-brand-200 px-3 py-1 rounded-input inline-block break-all">
                  {upgradeSuccessEmail}
                </span>
              </div>
            </div>

            <p className="text-caption text-ink bg-surface-low border border-slate-200 rounded-input p-3 text-left">
              Click the link in the email to verify this address. Your active relief requests, drives, and donation history are now connected to this login.
            </p>

            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                setIsUpgradeModalOpen(false)
                setUpgradeSuccessEmail(null)
                setUpgradeEmail('')
                setUpgradePassword('')
              }}
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleUpgradeSubmit} className="flex flex-col gap-4 select-text">
            <p className="text-caption text-ink-muted leading-relaxed">
              Convert your current session into a permanent ReliefLink account. Your requests, drives, and donation history will be preserved.
            </p>

            <Input
              id="upgrade-email"
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={upgradeEmail}
              onChange={e => setUpgradeEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
              autoComplete="email"
            />

            <Input
              id="upgrade-password"
              label="Create password"
              type="password"
              placeholder="At least 6 characters"
              value={upgradePassword}
              onChange={e => setUpgradePassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
              autoComplete="new-password"
            />

            {upgradeError && (
              <div className="bg-danger-bg border border-red-200 rounded-input p-3 text-caption text-danger">
                {upgradeError}
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <Button
                type="button"
                variant="secondary"
                fullWidth
                onClick={() => setIsUpgradeModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                isLoading={isUpgrading}
                rightIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Save Account
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <LocationPickerModal
        isOpen={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onConfirm={handleMapConfirm}
      />

      <Toast message={toastMessage} visible={Boolean(toastMessage)} />
    </AppShell>
  )
}
