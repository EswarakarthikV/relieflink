import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { enhanceRequestDescription, type EnhanceDescriptionResult } from '@/lib/gemini'

interface DescriptionEnhancerProps {
  description: string
  onApply: (enhanced: string) => void
  title: string
  category: string
}

export function DescriptionEnhancer({
  description,
  onApply,
  title,
  category,
}: DescriptionEnhancerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [suggestion, setSuggestion] = useState<EnhanceDescriptionResult | null>(null)

  const handleEnhance = async () => {
    if (isLoading || description.trim().length < 10) return

    setIsLoading(true)
    setApiError(null)
    setToastMessage(null)

    try {
      const result = await enhanceRequestDescription(description, title, category)

      if (!result.changed) {
        setToastMessage('Your description already looks clear.')
        setTimeout(() => setToastMessage(null), 3500)
      } else {
        setSuggestion(result)
        setIsModalOpen(true)
      }
    } catch {
      // User-friendly error without breaking typing or form
      setApiError('AI unavailable. Keep typing.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUseThis = () => {
    if (suggestion?.improved_description) {
      onApply(suggestion.improved_description)
    }
    setIsModalOpen(false)
  }

  const handleKeepMine = () => {
    setIsModalOpen(false)
  }

  return (
    <div className="flex flex-col gap-1 -mt-1">
      {/* AI Trigger button (visible if length >= 10) */}
      {description.trim().length >= 10 && (
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
              <span>✨ Improve description with AI</span>
            )}
          </button>
        </div>
      )}

      {/* Error state */}
      {apiError && (
        <p className="text-caption text-danger font-medium mt-0.5">{apiError}</p>
      )}

      {/* Toast notification when description is already clear */}
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
          {/* Card A: Original description */}
          <div>
            <label className="block text-[13px] font-semibold text-ink-muted uppercase tracking-wider mb-1.5">
              You wrote:
            </label>
            <div className="bg-slate-50 border border-slate-200 rounded-input p-3 text-ink text-body whitespace-pre-line">
              {description}
            </div>
          </div>

          {/* Card B: Suggested description */}
          <div>
            <label className="block text-[13px] font-semibold text-brand-600 uppercase tracking-wider mb-1.5">
              AI suggests:
            </label>
            <div className="bg-blue-50/80 border border-blue-200 rounded-input p-3.5 text-navy-900 font-medium text-body whitespace-pre-line">
              {suggestion?.improved_description}
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
              onClick={handleUseThis}
              fullWidth
            >
              Use this
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
