# Third-party software

Sound Constellations uses open-source components locally. It does not call external analysis services.

| Component                            | Purpose                                          | License / upstream                                            |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------- |
| Electron                             | Windows desktop runtime                          | MIT, https://github.com/electron/electron                     |
| React                                | User interface                                   | MIT, https://github.com/facebook/react                        |
| Three.js                             | WebGL constellation                              | MIT, https://github.com/mrdoob/three.js                       |
| Lucide                               | Interface icons                                  | ISC, https://lucide.dev/license                               |
| Meyda                                | Audio feature extraction                         | MIT, https://github.com/meyda/meyda                           |
| music-metadata                       | Local audio metadata                             | MIT, https://github.com/Borewit/music-metadata                |
| ffmpeg-static                        | Bundled FFmpeg executable                        | GPL-3.0-or-later, https://github.com/eugeneware/ffmpeg-static |
| FFmpeg 6.1.1 essentials (Gyan build) | Bounded local PCM decoding in a separate process | GPL v3; see the binary's accompanying LICENSE and README      |
| SQLite (through Node.js)             | Local analysis cache                             | Public domain, https://sqlite.org/copyright.html              |

The Windows development package includes Electron's `LICENSE` and `LICENSES.chromium.html`, plus FFmpeg's license and build information in `resources/app.asar.unpacked/node_modules/ffmpeg-static/`.

FFmpeg's packaged build README identifies its source revision as https://github.com/FFmpeg/FFmpeg/commit/e38092ef93. Before public redistribution, prepare the required corresponding source and third-party notices for the precise binaries shipped; this local development build is not a reviewed public distribution. Bundled dependencies retain their own licenses.

Generated test audio is synthesized by this project. It contains no third-party recordings.
