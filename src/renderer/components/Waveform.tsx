export default function Waveform({
  buckets,
  progress = 0,
  sampled = false,
}: {
  buckets: number[];
  progress?: number;
  sampled?: boolean;
}) {
  const max = Math.max(...buckets, 0.001);
  return (
    <svg
      className="waveform"
      viewBox="0 0 640 64"
      preserveAspectRatio="none"
      role="img"
      aria-label={
        sampled ? 'Amplitude envelope of the sampled analysis windows' : 'Audio amplitude waveform'
      }
    >
      <line x1="0" x2="640" y1="32" y2="32" stroke="currentColor" opacity="0.15" />
      {buckets.map((value, i) => {
        const height = Math.max(2, (value / max) * 54);
        return (
          <rect
            key={i}
            x={(i * 640) / buckets.length}
            y={(64 - height) / 2}
            width={Math.max(1, 640 / buckets.length - 1.5)}
            height={height}
            rx="0.6"
            fill={i / buckets.length < progress ? '#b5e6da' : '#567f80'}
          />
        );
      })}
    </svg>
  );
}
