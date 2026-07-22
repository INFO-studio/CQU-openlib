/** Section rule — stronger than `--c-line` (UI chrome), still quieter than ink. */
const parserThematicBreak = () => (
  <hr className="my-1 h-px w-full shrink-0 border-0 bg-[color-mix(in_srgb,var(--c-ink)_20%,transparent)]" />
);
export default parserThematicBreak;
