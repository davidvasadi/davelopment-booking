'use client'

import { motion } from 'framer-motion'

/**
 * Az EGYETLEN kapcsoló-komponens a Beállítások alatt. Korábban 6 fájl (PersonalNotifPrefsCard,
 * RolesManager, VoucherTypeManager, PaymentsSettingsPanel, SettingsHub, + a BookingFeatures/
 * GoogleSettingsPanel-féle nyers-hex arany-gombfejes variáns) mindegyike a sajátját írta újra —
 * az egyik (VoucherTypeManager) még más MÉRETŰ is volt (24×41px a többi 27×46px-je helyett),
 * ami látható méret-ugrást okozott fülváltáskor.
 *
 * A gomb-fej csúszása framer-motion springgel megy (nem sima CSS `transition`), hogy a mozgás
 * ugyanolyan "finom" legyen, mint az app többi spring-alapú belépője.
 */
const KNOB_SPRING = { type: 'spring', stiffness: 500, damping: 32, mass: 0.6 } as const

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean
  onChange: () => void
  label?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={disabled ? undefined : onChange}
      className={`relative h-[27px] w-[46px] shrink-0 rounded-full transition-colors duration-200 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${checked ? 'bg-ink-dark' : 'bg-track-off'}`}
    >
      <motion.span
        className="absolute top-[3px] h-[21px] w-[21px] rounded-full bg-white shadow-sm"
        animate={{ left: checked ? 22 : 3 }}
        transition={KNOB_SPRING}
      />
    </button>
  )
}
