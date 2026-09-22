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

## Windows installer and portable release

The 0.1.0 setup and portable executables were built and validated on 22 September 2026. Both contain the Electron runtime and local decoder.

| Check                  | Result                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- |
| Setup executable       | NSIS guided installer, Windows x64, 138,414,599 bytes                                                           |
| Portable executable    | Standalone launcher, Windows x64, 138,176,008 bytes                                                             |
| Installation           | Exit code 0; installed into a fresh temporary directory outside the source checkout                             |
| Prerequisite isolation | Application PATH restricted to Windows and System32; NODE_PATH, FFmpeg overrides, and development flags removed |
| Installed application  | 12 generated WAVs analyzed successfully; real preview playback started; no renderer errors                      |
| Relaunch               | All 12 records reused from the cache                                                                            |
| Shortcuts              | Start menu and desktop shortcuts created                                                                        |
| Uninstallation         | Exit code 0; test application, uninstall registration, and shortcuts removed                                    |
| Data preservation      | Separate test profile and SQLite cache retained                                                                 |
| Portable application   | Launched its bundled runtime, analyzed 12 WAVs, played a preview, and exited successfully                       |
| Regression suite       | All 15 unit tests passed                                                                                        |

`scripts/verify-installed.mjs` produces `test-results/installer-results.json` and installed/portable screenshots. It refuses to replace an existing installation or interrupt an already-running app. The checked installation and removal apply only to the temporary installation created by that test.

SHA-256 checksums accompany the release in `SHA256SUMS.txt`. The executable builds are unsigned. A clean Windows virtual machine was not available, so clean-machine compatibility has not been directly verified; the isolated installation and restricted application PATH establish that developer tools are not being resolved from this checkout.
