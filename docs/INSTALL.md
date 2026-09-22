# Install Sound Constellations

Sound Constellations is a Windows app for exploring your own audio files by similarity. Everything is analyzed on your computer. Your original samples are never changed.

## Download and install

1. Download **Sound-Constellations-Setup-0.1.0-x64.exe** from the release, or use the copy shared with you.
2. Double-click the downloaded file and follow the setup wizard.
3. Open **Sound Constellations** from the Start menu or desktop shortcut.
4. Choose **Choose Sample Folder**, select a folder containing audio, and let the first scan finish.
5. Click a star to preview a sound. Search, filters, and the nearest-sounds panel help you explore.

You do not need Node.js, Python, FFmpeg, a web browser installation, a paid service, or an account to use the app. The complete Electron runtime and local audio decoder are included. Setup and the application work offline after the download. Installation is for the current Windows user and does not request administrator privileges.

## System requirements

- Windows 10 or Windows 11, 64-bit Intel/AMD (x64).
- A graphics driver with WebGL support. Standard current Windows graphics drivers are generally suitable; updating the driver can help if the constellation cannot render.
- Approximately 1 GB of free disk space for installation and extraction, plus space for the analysis cache. Larger libraries use more cache space.

Windows on ARM, 32-bit Windows, macOS, and Linux are not release targets for this build.

## Windows security notice

This early release is not code-signed. Windows may display an unknown-publisher or SmartScreen warning. Check that the file came from the project owner or the repository release you intended to download. A managed work or school computer may require administrator approval under its security policy.

The release includes `SHA256SUMS.txt`. If desired, check the file in PowerShell with `Get-FileHash -Algorithm SHA256` and compare the result with the published checksum.

## Portable option

**Sound-Constellations-Portable-0.1.0-x64.exe** runs without installing or creating shortcuts. It includes the same runtime and decoder and extracts application files into a temporary directory when launched. The first start can take longer while those files unpack.

Portable mode still saves settings and analysis cache in your Windows user profile; it is not a completely stateless USB application. You only need to download one edition.

## Your files and settings

Your audio stays in its original folders. The app only reads it. Saved library paths, settings, and cached analysis normally live under `%APPDATA%\sound-constellations`; Settings displays the exact cache path.

Subsequent scans reuse unchanged audio analysis. Use **Rescan library** after adding, changing, or deleting files. Long-file previews cover the first 30 seconds, and their waveforms represent sampled analysis windows.

## Uninstall or update

Close the app, then remove **Sound Constellations** through Windows Settings → Apps → Installed apps. Uninstalling removes the app and its shortcuts while retaining its analysis cache and preferences. Original audio files are never removed.

To update, close the app and run the newer installer. The installer retains your saved app data.

## GitHub downloads

This repository and its downloads are public. You do not need a GitHub account to download, install, or use the app.
