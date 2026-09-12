# 001 — Provision the Expo app shell

- **Status:** todo
- **Priority:** critical
- **Sequence:** 1
- **Summary:** Create the React Native + Expo + TypeScript app shell for iOS and Android.
- **Labels:** foundation, mobile, expo
- **Depends on:** none

## Goal

Create the minimal React Native + Expo + TypeScript app for iOS and Android, with a stable package identity and a basic navigation shell.

## Acceptance criteria

- The app starts from a clean checkout using documented commands.
- A physical iOS device and Android device can launch the development build.
- The shell has placeholder routes for profile selection, story/session setup, active session, and parent settings.
- Camera and microphone permission copy is present but permissions are requested only when needed.

## Notes

Follow the native-platform decision in `changelog/2026-09-12-platform-and-scope.md`. Do not add a backend, authentication, analytics, or cloud storage.
