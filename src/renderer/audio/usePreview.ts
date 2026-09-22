import { useCallback, useEffect, useRef, useState } from 'react';
import type { AudioFile, Settings } from '../../shared/types';
export function usePreview(settings: Settings, onError: (message: string) => void) {
  const context = useRef<AudioContext | null>(null);
  const source = useRef<AudioBufferSourceNode | null>(null);
  const gain = useRef<GainNode | null>(null);
  const cache = useRef(new Map<string, AudioBuffer>());
  const request = useRef(0);
  const current = useRef<AudioFile | null>(null);
  const offset = useRef(0);
  const started = useRef(0);
  const active = useRef(false);
  const config = useRef(settings);
  config.current = settings;
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const halt = useCallback(() => {
    if (source.current) {
      source.current.onended = null;
      source.current.stop();
      source.current.disconnect();
      source.current = null;
    }
    active.current = false;
    setPlaying(false);
  }, []);
  const stop = useCallback(() => {
    request.current++;
    halt();
    offset.current = 0;
    setPosition(0);
    setLoading(false);
  }, [halt]);
  const play = useCallback(
    async (file: AudioFile, resume = false) => {
      const token = ++request.current;
      halt();
      current.current = file;
      if (!resume) offset.current = 0;
      setPosition(offset.current);
      setLoading(true);
      try {
        if (!context.current) {
          context.current = new AudioContext();
          gain.current = context.current.createGain();
          gain.current.connect(context.current.destination);
        }
        const ctx = context.current;
        await ctx.resume();
        const key = `${file.id}:${file.modifiedAt}:${file.size}`;
        let buffer = cache.current.get(key);
        if (!buffer) {
          const response = await window.sound.preview(file.id);
          if (token !== request.current) return;
          const bytes = response.pcm;
          const pcm = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
          const length = pcm.length / response.channels;
          buffer = ctx.createBuffer(response.channels, length, response.sampleRate);
          for (let channel = 0; channel < response.channels; channel++) {
            const samples = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) samples[i] = pcm[i * response.channels + channel];
          }
          // A small LRU avoids keeping full libraries decoded. At most ~32 MiB of stereo PCM.
          cache.current.set(key, buffer);
          let total = [...cache.current.values()].reduce(
            (sum, b) => sum + b.length * b.numberOfChannels * 4,
            0,
          );
          while (cache.current.size > 1 && (cache.current.size > 10 || total > 32 * 1024 * 1024)) {
            const oldest = cache.current.keys().next().value!;
            const old = cache.current.get(oldest)!;
            total -= old.length * old.numberOfChannels * 4;
            cache.current.delete(oldest);
          }
        } else {
          cache.current.delete(key);
          cache.current.set(key, buffer);
        }
        if (token !== request.current) return;
        const node = ctx.createBufferSource();
        node.buffer = buffer;
        node.loop = config.current.loop;
        node.connect(gain.current!);
        gain.current!.gain.value = config.current.volume;
        source.current = node;
        const from = offset.current >= buffer.duration ? 0 : offset.current;
        offset.current = from;
        started.current = ctx.currentTime - from;
        node.start(0, from);
        active.current = true;
        setPreviewDuration(buffer.duration);
        setPlaying(true);
        setLoading(false);
        node.onended = () => {
          if (token === request.current) {
            active.current = false;
            setPlaying(false);
            setPosition(0);
            offset.current = 0;
          }
        };
      } catch (error) {
        if (token === request.current) {
          setLoading(false);
          setPlaying(false);
          onError(`Preview unavailable: ${String(error)}`);
        }
      }
    },
    [halt, onError],
  );
  const toggle = useCallback(
    (file: AudioFile | undefined) => {
      if (!file) return;
      if (active.current && current.current?.id === file.id) {
        offset.current =
          (context.current!.currentTime - started.current) %
          Math.max(0.001, source.current!.buffer!.duration);
        request.current++;
        halt();
      } else void play(file, current.current?.id === file.id);
    },
    [halt, play],
  );
  useEffect(() => {
    if (gain.current)
      gain.current.gain.setTargetAtTime(settings.volume, context.current!.currentTime, 0.02);
    if (source.current) source.current.loop = settings.loop;
  }, [settings.volume, settings.loop]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (active.current && context.current && source.current?.buffer)
        setPosition(
          (context.current.currentTime - started.current) % source.current.buffer.duration,
        );
    }, 40);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () => () => {
      request.current++;
      if (source.current) {
        source.current.onended = null;
        source.current.stop();
      }
      void context.current?.close();
      context.current = null;
    },
    [],
  );
  return { play, stop, toggle, playing, loading, position, previewDuration };
}
