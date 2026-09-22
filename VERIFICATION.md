# V1 verification — 22 September 2026

This records work executed on the development Windows machine. It is not a claim of testing on a clean Windows installation or a physical audio device.

| Area                        | Result                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| TypeScript                  | Strict typecheck passes                                                                                                                          |
| Unit tests                  | 15 tests pass: DSP, normalization, distances, PCA, SQLite, settings, traversal, junctions, cancellation                                          |
| Actual codecs               | Generated PCM16 WAV, MP3, FLAC, OGG Vorbis and M4A AAC decoded locally                                                                           |
| Similarity sanity           | 8/8 generated kicks have another kick as their closest neighbour                                                                                 |
| Source preservation         | Source SHA-256 hashes unchanged after scanning and analysis                                                                                      |
| Incremental scan            | Add/change/delete fixture: 2 analyses, 50 cache hits, deleted file excluded                                                                      |
| Cancellation                | Cancelled after 3 completed files; those 3 records reused on resume                                                                              |
| Cold 5,000-file scan        | 5,000 successes, 0 failures, 525.89 seconds                                                                                                      |
| Warm 5,000-file scan        | 5,000 cache hits, 0 analyses, 2.25 seconds in the Node worker benchmark                                                                          |
| Memory                      | About 255 MiB peak Node parent/worker RSS during cold benchmark; decoder subprocesses excluded                                                   |
| Packaged Windows app        | Launch, 5,000 sounds loaded, real bundled decoder playback, search, saved settings and process relaunch verified                                 |
| Packaged performance sample | Initial run: ~12.84 s startup scan; median 13.3 ms / p95 13.5 ms frame intervals over 180 frames; ~55 ms search interaction                      |
| UI workflow                 | Native-picker IPC path (controlled test response), star hover/click, zoom, selection, neighbours, preview, search, filters, 2D, settings, rescan |
| UI sizes                    | Desktop and 1000×700 outer window captured; no horizontal document overflow                                                                      |
| Electron boundary           | Context isolation and sandbox enabled; renderer Node access absent; invalid sound IDs and settings rejected                                      |
| Vite development mode       | Electron renderer launches successfully with local React refresh                                                                                 |

Evidence is generated under `test-results/` and deliberately excluded from Git:

- `integration-results.json`: actual formats, source hashes, incremental changes and cancellation.
- `benchmark-results.json`: cold and warm 5,000-file timing.
- `ui-results.json`: user workflows and secure-window assertions.
- `package-results.json`: packaged rendering/search/playback measurements.
- `01-landing.png` through `06-development.png`: captured application screens (numbered images present for each executed scenario).

Exact results vary with background load, graphics settings, and storage. Repeated package verification may overwrite the JSON with a newer measurement. The figures above describe the first successful full measurement.

Not established by these checks: human listening quality on a real sample collection, every encoding variant, OS-native picker navigation itself, physical speaker output, a complete accessibility/security audit, signed-installer behavior, or clean-machine compatibility. Previews are deliberately limited to 30 seconds. Long-file waveforms describe sampled windows.

Run commands and architecture are in `README.md`; license and redistribution preparation are in `THIRD_PARTY_NOTICES.md`.
