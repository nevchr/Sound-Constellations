# Sound Constellations

A Windows desktop sample explorer. Choose your own audio folders, then move through a 3D constellation in which nearby points have similar measured acoustic features. Each point represents a real file. Click a star to hear it; choose one of its nearest neighbours to continue listening.

## Run locally

Requirements: Windows 10/11 x64 and Node.js 24 or newer. Dependencies are needed once; scanning, analysis, playback, and storage then work offline.

```powershell
pnpm install
pnpm dev
```

For a compiled development build:

```powershell
pnpm build
pnpm start
```

`npm install`, `npm run dev`, `npm run build`, and `npm start` are equivalent if npm is available. This repository has a `pnpm-lock.yaml`; pnpm is the reproducible installation path. pnpm's approved build scripts are specified in `pnpm-workspace.yaml`. If Electron's binary has not been installed by your package manager, run `node node_modules/electron/install.js`.

Generate 48 small, real WAV fixtures:

```powershell
pnpm test:library
```

Then choose this project's `test-library` directory in the app. Nothing is auto-imported into a normal user's profile. Generated audio is ignored by Git.

## Using the explorer

- **Choose Sample Folder / Add folder:** native Windows picker; multiple sources are supported and remembered.
- **Drag:** orbit in 3D or pan in 2D. **Right drag:** pan. **Scroll:** zoom.
- **Click:** select and auto-preview (configurable). **Double-click / Focus:** animate the camera toward the selection.
- **Space:** play/pause when focus is outside a form control. The player also provides retrigger, stop, loop, and volume.
- **/** focuses search. Search covers names, full folder paths, and extensions. Enter focuses the first matching result. Escape clears the search.
- **Sound list:** keyboard-accessible selection, showing the first 100 matching files. Refine search for larger lists.
- **Folder, format and duration filters:** change visibility without rerunning analysis. Hidden points are dimmed. Neighbour ranking still uses the complete library; connections to hidden points are omitted.
- **Rescan library:** discovers additions, changes and deletions. Unchanged analysis is reused.
- **Cancel:** retains every completed cache record; the partial constellation can be used immediately.
- **Show in Explorer:** reveals the original file. It never opens it in an editor or changes it.

Point size represents log duration. The restrained teal-to-lilac palette represents spectral centroid, with luminance influenced by RMS. There are no inferred instrument, genre, or mood labels. Inspector bars are measured features relative to the current library, not semantic predictions.

## How it works

```text
Local files → metadata + bounded PCM decoding → Meyda features
            → per-file means and deviations → dataset standardization
            → Euclidean nearest neighbours → deterministic PCA → Three.js
```

**Decoding and sampling.** A background Node worker invokes the bundled FFmpeg executable without a shell. Audio is downmixed to 22,050 Hz mono for analysis. Short files are analyzed in full; long files use five equal windows at the beginning, quarter, middle, three-quarter and end positions. The default total sampling budget is 12 seconds per file, configurable from 5–60 seconds. Each decoder job has a 30-second wall-time limit and bounded output. Metadata retains the original sample rate, channel count and bit depth where available.

**Features.** Measured features are duration, RMS, peak, spectral centroid, spectral spread, 99% spectral rolloff, spectral flatness, zero-crossing rate, and 13 MFCC coefficients. Meyda uses 1,024-sample frames with a 512-sample hop and a Hann window. Frame statistics are aggregated; spectral moments are converted from FFT bins into Hz. The 26-dimensional comparison vector contains log duration, log RMS, peak, five mean spectral/texture values, MFCCs 1–12, and six frame-level standard deviations. MFCC 0 is recorded for inspection but omitted from comparison because it duplicates energy information. Silence and constant dimensions are handled without NaNs.

**Similarity.** Each dimension is standardized as `(value - mean) / populationStandardDeviation`. Distance is the RMS Euclidean difference across standardized dimensions. Neighbours are ranked in the original feature space, not by projected screen distance. The displayed 0–100 **similarity score** is `100 / (1 + distance)`, an informal relative score, not probability or certainty. Characteristics use bounded standardized feature values; they change when the library changes.

**Projection.** PCA uses a small covariance matrix, fixed-seed power iteration and canonical axis signs. File ordering is stable. Identical libraries and analysis settings reproduce the same coordinates; adding or removing files changes dataset normalization and may move existing points. A `DimensionReducer` interface allows another reducer later. A single Three.js `Points` buffer draws the library; selected-neighbour connections are limited to 1–10. Exact acoustic duplicates may share coordinates; the sound list can select them independently.

**Preview.** A separate asynchronous decoder job preserves stereo and produces 44,100 Hz PCM. Web Audio handles playback, pause, loop, and gain. Previews are limited to the **first 30 seconds**, explicitly labelled for long files. A small in-memory LRU holds at most 10 sounds and approximately 32 MiB of decoded audio. The first play includes decoder startup; repeat triggers use the cached buffer. Samples are never overwritten or converted on disk. The waveform uses up to 160 peak buckets; long-file displays are explicitly labelled as sampled envelopes and are not seekable full-track waveforms.

## Architecture

| Location               | Responsibility                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------- |
| `src/main/main.ts`     | Secure Electron window, validated IPC, native picker, preview service, app protocol |
| `src/main/filesystem/` | Recursive read-only traversal and stable path IDs                                   |
| `src/main/analysis/`   | Bounded decoder, sample windows, local DSP                                          |
| `src/main/worker.ts`   | Cancellable scanning, analysis, cache and projection away from the UI               |
| `src/main/cache/`      | SQLite records and version-aware invalidation                                       |
| `src/preload/`         | Explicit context-isolated API; no general filesystem or process access              |
| `src/shared/`          | Strict types, standardization, distances and interchangeable reducer                |
| `src/renderer/`        | React explorer, efficient Three.js scene, Web Audio player and components           |
| `scripts/`, `tests/`   | Generated fixtures, unit/integration/UI tests and performance benchmark             |

## Cache and settings

Data is stored in Electron's per-user application-data directory, usually `%APPDATA%/sound-constellations/`. The exact cache path appears in Settings.

- `analysis.sqlite`: one record per canonical path, with file size, modification timestamp, `ANALYSIS_VERSION`, sampling budget, metadata, features and waveform.
- `preferences.json`: selected roots and validated settings, saved through serialized temporary-file replacement.
- Cache matching requires path, size, timestamp, analysis version and sampling budget to match. Algorithm changes require incrementing `ANALYSIS_VERSION`.
- Each completed file is committed independently. Cancellation cannot discard previous completed entries. Deleted entries are pruned only after complete discovery without filesystem errors; inaccessible/cancelled scans defer pruning. Missing files are excluded from the active constellation.
- Startup rescans metadata to discover changes and reconstructs PCA; unchanged audio is not decoded again. Failed files are retried on a subsequent rescan.

## Privacy and safety

Sound Constellations analyzes your audio locally. Audio files are not uploaded. No account or cloud service is required.

The app only reads sample libraries. It has no sample rename, move, delete, edit, tag-writing, or export functions. Cache writes are confined to application data. Symlink/junction entries are skipped to avoid cycles and implicit traversal outside selected roots. Overlapping folders are deduplicated. Files that change during analysis or before preview are rejected until rescanned.

Electron uses `contextIsolation: true`, `nodeIntegration: false`, a sandboxed preload, sender and argument validation, denied permissions, denied navigation/popups, a restricted content security policy, and a local `app://` asset protocol. Renderer requests cannot specify arbitrary file paths. Runtime network requests are blocked; the development Vite origin is the only development exception. These controls and local tests are not a comprehensive security audit of the application or its bundled codecs.

## Supported and tested formats

The scanner accepts `.wav`, `.mp3`, `.flac`, `.ogg`, and `.m4a`, case-insensitively. Local integration tests decode generated **PCM16 WAV, MP3, FLAC, OGG Vorbis, and M4A AAC** fixtures. This confirms those tested encodings, not every possible codec/container variant. Protected, malformed, or incompatible audio is reported safely. Bit depth and other unavailable metadata are omitted rather than guessed.

The scan report separates discovered candidate/recognized audio files, newly analyzed, cached, unsupported formats, skipped entries and failures. Non-audio files, links and dot-prefixed entries count as skipped. Directory access errors also count as failures, so these counters are not always a partition of the discovered file count. Up to 100 detailed issues are retained per scan.

## Verification

```powershell
pnpm test
pnpm build
pnpm test:integration
pnpm test:ui
node scripts/benchmark.mjs 5000
```

Unit tests cover standardization, similarity, deterministic PCA, silence, real tones, cache invalidation, filesystem traversal, junction handling and input validation. Integration tests use real decoder output and source SHA-256 hashes to verify incremental updates, cancellation, cache reuse and read-only behavior. The UI smoke test launches Electron in a disposable profile and uses a controlled picker response pointing to generated files; it does not drive the operating-system folder-picker interface itself. Screenshots and JSON evidence are written under `test-results/` (ignored by Git). The benchmark generates actual WAV files and runs cold and warm scans.

In development, Ctrl+Shift+D toggles a raw-feature inspector when focus is outside a form control. Production builds omit that keyboard shortcut.

Measured on the development Windows machine, with 5,000 generated WAV files: the first scan analyzed all 5,000 in **525.89 seconds (8m 46s)** with no failures; the second scan reused all 5,000 records in **2.25 seconds**. Peak combined Node parent/worker RSS was about 255 MiB in the cold run, excluding the separate decoder processes. These are fixture measurements on this machine, not a guarantee for arbitrary libraries.

The packaged Electron app also loaded those 5,000 cached sounds and played a preview using its bundled decoder. Its startup scan took about **12.84 seconds** including Electron/worker/IPC overhead; a 180-frame sample measured **13.3 ms median / 13.5 ms p95** frame intervals, and a search interaction took about **55 ms**. A complete process exit and relaunch preserved 5,000 cache hits and saved settings. Automated tests confirm playback state; speaker output has not been assessed by a human.

## Windows development package

```powershell
pnpm build:win
```

Run `release/win-unpacked/Sound Constellations.exe`. Keep the entire `win-unpacked` directory together: it includes Electron, the app and the local decoder. No installation or administrator access is required. This is an unsigned development package, not a signed installer or public release. Build dependencies may download open-source binaries during installation and packaging; the finished app works offline. See `THIRD_PARTY_NOTICES.md` for licenses and distribution preparation.

An isolated profile can be selected with an absolute `--user-data-dir=C:\\path\\to\\profile` argument. This controls only the app's own data. `node scripts/verify-package.mjs --packaged` uses this mechanism to test the packaged build against the generated 5,000-file benchmark without changing the normal user profile.

## Current limitations and next steps

- Classical DSP similarity is useful for timbre, duration and energy; it does not identify instruments, genres, vocals, BPM, musical key, or intent. Validate neighbour quality against your actual sample packs.
- Previews stop at 30 seconds. Waveforms for long files summarize the sampled windows. Full-length streaming and seeking would be a later improvement.
- Dot-prefixed files/folders can be excluded; Windows' separate Hidden attribute is not currently inspected. Symlink/junction entries are deliberately skipped.
- Cold analysis is sequential and invokes a local decoder for each file/window. Scan time depends on file duration, codec, storage and machine. Thousands of files require time on the first pass; use cancellation and caching.
- Metadata is parsed locally before bounded decoding. Particularly large or damaged metadata can delay the current file. PCA projection is brief but its synchronous worker calculation is not interrupted mid-operation.
- Original source folders are remembered; V1 supports adding sources but has no in-app source-removal manager. It does not watch folders automatically.
- WebGL requires a functioning graphics driver. Search, the list, inspector and playback remain available if WebGL cannot initialize. No physical audio-output or multi-machine compatibility claim is made by automated playback tests.
- Public release work should include real-library listening tests, updated codec binaries and corresponding-source packaging, a signed installer, and clean Windows-machine verification. No updater, telemetry, cloud service or paid feature is included.
