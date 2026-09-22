import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export async function generateLibrary(destination = 'test-library', count = 48) {
  const rate = 22050;
  const groups = [
    'Drums/Kicks',
    'Drums/Hats',
    'Drums/Snares',
    'Misc/Tones',
    'Loops/House',
    'FX/Atmospheres',
  ];
  for (let index = 0; index < count; index++) {
    const group = index % groups.length;
    const variation = Math.floor(index / groups.length);
    const directory = path.join(destination, groups[group]);
    await mkdir(directory, { recursive: true });
    const seconds = [
      0.35 + (variation % 8) * 0.009,
      0.12 + (variation % 8) * 0.003,
      0.27 + (variation % 8) * 0.005,
      0.6,
      4,
      2,
    ][group];
    const length = Math.floor(rate * seconds);
    const pcm = new Int16Array(length);
    let random = 1000 + index;
    let phase = 0;
    let previousNoise = 0;
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      random = (1664525 * random + 1013904223) >>> 0;
      const noise = random / 2147483648 - 1;
      let sample = 0;
      const shift = 1 + (variation % 8) * 0.018;
      if (group === 0) {
        phase += (2 * Math.PI * (48 + 135 * Math.exp(-t * 33)) * shift) / rate;
        sample = Math.sin(phase) * Math.exp(-t * 15);
      }
      if (group === 1) sample = (noise - previousNoise) * 0.4 * Math.exp(-t * 48);
      if (group === 2)
        sample = (noise * 0.6 + Math.sin(2 * Math.PI * 175 * shift * t) * 0.35) * Math.exp(-t * 19);
      if (group === 3)
        sample =
          Math.sin(2 * Math.PI * (220 + (variation % 8) * 30) * t) *
          0.45 *
          Math.min(t * 50, 1, (seconds - t) * 50);
      if (group === 4) {
        const beat = t % 0.5;
        sample =
          Math.sin(2 * Math.PI * (55 * beat + 1.5 * (1 - Math.exp(-beat * 35)))) *
            Math.exp(-beat * 19) *
            0.7 +
          noise * Math.exp(-(t % 0.25) * 70) * 0.17;
      }
      if (group === 5)
        sample =
          (Math.sin(2 * Math.PI * 130 * shift * t) + 0.5 * Math.sin(2 * Math.PI * 196 * t)) *
          0.2 *
          Math.sin((Math.PI * t) / seconds);
      previousNoise = noise;
      pcm[i] = Math.round(Math.max(-1, Math.min(1, sample * 0.8)) * 32767);
    }
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + pcm.byteLength, 4);
    header.write('WAVEfmt ', 8);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(1, 22);
    header.writeUInt32LE(rate, 24);
    header.writeUInt32LE(rate * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(pcm.byteLength, 40);
    const label = ['Kick', 'Hat', 'Snare', 'Tone', 'House_Loop', 'Atmosphere'][group];
    await writeFile(
      path.join(directory, `${label}_${String(variation + 1).padStart(3, '0')}.wav`),
      Buffer.concat([header, Buffer.from(pcm.buffer)]),
    );
  }
  return path.resolve(destination);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const destination = process.argv[2] ?? 'test-library';
  const count = Number(process.argv[3] ?? 48);
  if (!Number.isInteger(count) || count < 1 || count > 20000)
    throw new Error('Count must be 1–20,000');
  console.log(`Generated ${count} real WAV sounds in ${await generateLibrary(destination, count)}`);
}
