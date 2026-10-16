import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { enhanceRequestTitle, type EnhanceTitleResult } from '@/lib/gemini'

interface TitleEnhancerProps {
  value: string
  onChange: (value: string) => void
  description: string
  category: string
  error?: string
}

export function TitleEnhancer({
  value,
  onChange,
  description,
  category,
  error,
}: TitleEnhancerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [suggestion, setSuggestion] = useState<EnhanceTitleResult | null>(null)

  const handleEnhance = async () => {
    if (isLoading || value.trim().length < 5) return

    setIsLoading(true)
    setApiError(null)
    setToastMessage(null)

    try {
      const result = await enhanceRequestTitle(value, description, category)

      if (!result.changed) {
        setToastMessage('Your title already looks clear.')
        setTimeout(() => setToastMessage(null), 3500)
      } else {
        setSuggestion(result)
        setIsModalOpen(true)
      }
    } catch {
      // Show user-friendly error without breaking typing or form
      setApiError('AI unavailable. Keep typing.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseTitle = () => {
    if (suggestion?.improved_title) {
      onChange(suggestion.improved_title)
    }
    setIsModalOpen(false)
  }

  const handleKeepMine = () => {
    setIsModalOpen(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Input
        label="Request title *"
        placeholder="e.g. Drinking water for 200 families"
        value={value}
        onChange={e => {
          onChange(e.target.value)
          if (apiError) setApiError(null)
        }}
        error={error}
      />

      {/* AI Trigger button (visible if length >= 5) */}
      {value.trim().length >= 5 && (
        <div className="flex items-center justify-between pt-0.5">
          <button
            type="button"
            onClick={handleEnhance}
            disabled={isLoading}
            className="text-caption font-semibold text-brand-600 hover:text-blue-700 active:text-blue-800 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer select-none py-0.5"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking...</span>
              </>
            ) : (
              <span>✨ Improve title with AI</span>
            )}
          </button>
        </div>
      )}

      {/* Error state */}
      {apiError && (
        <p className="text-caption text-danger font-medium mt-0.5">{apiError}</p>
      )}

      {/* Toast notification when title is already clear */}
      {toastMessage && (
        <div className="bg-slate-100 border border-slate-200 text-ink text-caption px-3 py-2 rounded-input flex items-center justify-between animate-in fade-in duration-200">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-ink-muted hover:text-ink text-xs ml-2 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Comparison Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleKeepMine}
        title="AI suggestion"
      >
        <div className="flex flex-col gap-4 mt-2">
          {/* Card A: Original title */}
          <div>
            <label className="block text-[13px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              You wrote:
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-input p-3 text-ink text-body">
              {value}
            </div>
          </div>

          {/* Card B: Suggested title */}
          <div>
            <label className="block text-[13px] font-semibold text-brand-600 uppercase tracking-wider mb-1.5">
              AI suggests:
            </label>
            <div className="bg-blue-50/80 border border-blue-200 rounded-input p-3.5 text-navy-900 font-semibold text-body">
              {suggestion?.improved_title}
            </div>
          </div>

          {/* Reasoning */}
          {suggestion?.reasoning && (
            <p className="text-[13px] text-ink-muted leading-relaxed">
              {suggestion.reasoning}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleKeepMine}
              fullWidth
            >
              Keep mine
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleUseTitle}
              fullWidth
            >
              Use this title
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
