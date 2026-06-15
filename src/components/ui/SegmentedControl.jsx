import clsx from 'clsx';

// A row of mutually-exclusive options rendered as the tao "filled vs paper" toggle. Shared by the
// engine strength dial and the free-play side picker. `options` is [{ value, label, sublabel? }].
export default function SegmentedControl({ options, value, onChange, className = 'flex gap-2', buttonClassName }) {
  return (
    <div className={className}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={clsx(
            'flex min-h-touch flex-col items-center justify-center border-3 border-foreground px-4 font-semibold leading-tight transition-all',
            value === option.value ? 'bg-foreground text-white' : 'bg-white text-gray-700 hover:bg-brand-50',
            buttonClassName,
          )}
        >
          <span>{option.label}</span>
          {option.sublabel && <span className="mt-0.5 text-[0.65rem] font-normal opacity-70">{option.sublabel}</span>}
        </button>
      ))}
    </div>
  );
}
