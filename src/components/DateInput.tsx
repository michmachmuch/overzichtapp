import { useRef, useState } from 'react'
import { dmy, parseDmy } from '../format'

/**
 * Date field that always shows dd/mm/jjjj. The browser's own date field follows the
 * system locale (e.g. mm/dd/yyyy), so the native picker is only used behind the 📅 button.
 */
export function DateInput({ value, onChange, label }: { value: string; onChange: (isoDate: string) => void; label: string }) {
  const [text, setText] = useState(value ? dmy(value) : '')
  const [lastValue, setLastValue] = useState(value)
  const picker = useRef<HTMLInputElement>(null)
  if (value !== lastValue) {
    // Value changed from outside (e.g. form reset or picker).
    setLastValue(value)
    setText(value ? dmy(value) : '')
  }
  const invalid = text !== '' && parseDmy(text) === null
  return (
    <span className="date-input">
      <input
        value={text}
        placeholder="dd/mm/jjjj"
        inputMode="numeric"
        aria-label={label}
        aria-invalid={invalid}
        className={invalid ? 'is-invalid' : ''}
        onChange={(e) => {
          // Keep only digits and put the slashes in: 18122026 → 18/12/2026.
          const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
          const t = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4)].filter(Boolean).join('/')
          setText(t)
          const iso = parseDmy(t)
          const next = iso ?? ''
          setLastValue(next)
          onChange(next)
        }}
      />
      <button type="button" className="icon-btn" aria-label="Kies datum" onClick={() => picker.current?.showPicker?.()}>📅</button>
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="date-native"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  )
}
