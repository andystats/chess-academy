import clsx from 'clsx';

// An uppercase mono pill with a thick ink border — the tao-rwd tag treatment. `tone` tints the
// background with an accent; the default is paper.
const TONES = {
  default: 'bg-white',
  brand: 'bg-brand-100',
  mint: 'bg-accent-mint/40',
  yellow: 'bg-accent-yellow',
};

export default function Badge({ children, tone = 'default', className }) {
  return <span className={clsx('tao-badge', TONES[tone] ?? TONES.default, className)}>{children}</span>;
}
