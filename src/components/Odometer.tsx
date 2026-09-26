/** Balance shown as a mechanical odometer: six whole digits and two accent-coloured decimals. */
export function Odometer({ value }: { value: number }) {
  const [whole, decimals] = value.toFixed(2).split(".");
  return (
    <div
      className="odometer inline-flex border border-ink font-mono text-[clamp(2.25rem,5vw,3.5rem)] leading-none tabular-nums"
      aria-label={value.toFixed(2)}
    >
      {whole
        .padStart(6, "0")
        .split("")
        .map((digit, i) => (
          <span key={`w${i}`} className="py-3" aria-hidden>
            {digit}
          </span>
        ))}
      {decimals.split("").map((digit, i) => (
        <span key={`d${i}`} className="dec py-3" aria-hidden>
          {digit}
        </span>
      ))}
    </div>
  );
}
