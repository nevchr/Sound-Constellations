import { spawn } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
export function decoderPath() {
  if (!ffmpegPath) throw new Error('No local audio decoder is available for this platform.');
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}
export async function decodePcm(
  filename: string,
  offset: number,
  seconds: number,
  rate = 22050,
  channels = 1,
  signal?: AbortSignal,
): Promise<Float32Array> {
  if (signal?.aborted) throw new Error('Cancelled');
  return new Promise((resolve, reject) => {
    // No shell, no stdin, no remote protocols, bounded output and wall time. The only output is stdout.
    const child = spawn(
      decoderPath(),
      [
        '-nostdin',
        '-hide_banner',
        '-loglevel',
        'error',
        '-protocol_whitelist',
        'file,pipe',
        '-ss',
        String(offset),
        '-i',
        filename,
        '-t',
        String(seconds),
        '-vn',
        '-sn',
        '-dn',
        '-ac',
        String(channels),
        '-ar',
        String(rate),
        '-f',
        'f32le',
        'pipe:1',
      ],
      { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const chunks: Buffer[] = [];
    let bytes = 0;
    let errors = '';
    let limitError = '';
    const limit = Math.ceil(seconds * rate * channels * 4) + 65536;
    const abort = () => {
      limitError = 'Cancelled';
      child.kill();
    };
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => {
      limitError = 'Decoder timed out';
      child.kill();
    }, 30000);
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > limit) {
        limitError = 'Decoder output exceeded its limit';
        child.kill();
      } else chunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      errors = (errors + chunk.toString()).slice(-1500);
    });
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    child.on('error', (error) => {
      cleanup();
      reject(error);
    });
    child.on('close', (code) => {
      cleanup();
      if (limitError || code !== 0 || !bytes) {
        reject(new Error(limitError || errors || 'Audio could not be decoded'));
        return;
      }
      const buffer = Buffer.concat(chunks);
      const copy = new Float32Array(Math.floor(buffer.length / 4));
      for (let i = 0; i < copy.length; i++) copy[i] = buffer.readFloatLE(i * 4);
      resolve(copy);
    });
  });
}
