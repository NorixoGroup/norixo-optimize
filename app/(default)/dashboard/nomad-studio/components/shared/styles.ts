// Classes d'interaction communes : anneau de focus clavier visible et zones tactiles de 44 px sur mobile.
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white";

export const TOUCH_TARGET = "min-h-[44px] sm:min-h-[36px]";

export const BUTTON_DARK = `inline-flex items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 ${TOUCH_TARGET} ${FOCUS_RING}`;

// Bouton inactif : reste atteignable au clavier (aria-disabled) et lisible (contraste AA).
export const BUTTON_INACTIVE = `inline-flex cursor-not-allowed items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-4 text-sm font-semibold text-slate-600 ${TOUCH_TARGET} ${FOCUS_RING}`;

export const KICKER = "text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600";
