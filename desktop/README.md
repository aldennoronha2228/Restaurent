# NexResto Desktop (Windows)

This folder contains an updater-enabled Electron wrapper for NexResto.

## Why this exists

Older ZIP/EXE builds do not auto-update. Users must install this updater-enabled installer once.
After that, future releases are detected and installed automatically.

## Local build

1. Install desktop dependencies:

```bash
cd desktop
npm install
```

2. Build installer:

```bash
npm run dist
```

Installer output will be in `desktop/dist`.

## Release and auto-update channel

- GitHub Action in `.github/workflows/windows-desktop-release.yml` publishes release artifacts.
- `electron-updater` checks GitHub Releases for updates.
- Updates are downloaded in background and applied on restart.

## One-time migration for existing users

Users with old ZIP/EXE builds must manually install the new installer one time.
After this migration, updates are automatic.
