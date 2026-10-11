import clsx from 'clsx';

export default function ClickableMove({
  san,
  ply,
  comment,
  isActive = false,
  onClick,
  className,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-sm font-semibold transition-all',
        isActive
          ? 'bg-brand-600 text-white shadow-sm ring-2 ring-brand-400'
          : 'bg-amber-100/70 text-gray-900 hover:bg-brand-100 hover:text-brand-900 active:scale-95',
        className,
      )}
      title={comment || `Jump to move ${san}`}
    >
      {ply && <span className="text-[0.72rem] opacity-70">{Math.ceil(ply / 2)}{ply % 2 === 1 ? '.' : '...'}</span>}
      <span>{san}</span>
    </button>
  );
}
