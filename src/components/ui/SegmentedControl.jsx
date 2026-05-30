import clsx from 'clsx';

// A row of mutually-exclusive options rendered as the tao "filled vs paper" toggle. Shared by the
// engine strength dial and the free-play side picker. `options` is [{ value, label }].
export default function SegmentedControl({ options, value, onChange, className, buttonClassName }) {
  return (
    <div className={clsx('flex gap-2', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'min-h-touch border-3 border-foreground px-4 font-semibold transition-all',
            value === option.value ? 'bg-foreground text-white' : 'bg-white text-gray-700 hover:bg-brand-50',
            buttonClassName,
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
