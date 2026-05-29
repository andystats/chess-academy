// Two-column lesson shell: the board on one side, the teaching panel on the other. Stacks the
// board above the panel on narrow screens. Children are <BoardPanel> and <StepPanel>.
export default function LessonLayout({ board, panel }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-start lg:justify-center lg:gap-12">
        <div className="flex w-full justify-center lg:flex-1">{board}</div>
        <div className="flex w-full justify-center lg:flex-1 lg:justify-start">{panel}</div>
      </div>
    </div>
  );
}
