# 007 — Add local child profiles and session history

- **Status:** todo
- **Priority:** high
- **Summary:** Keep multiple child profiles and summaries isolated on-device.
- **Labels:** privacy, profiles, storage
- **Depends on:** 001, 005

## Goal

Allow multiple children to share one device while keeping profiles and session summaries isolated and local.

## Acceptance criteria

- A caregiver can create, select, edit, and delete profiles behind a parent gate.
- Each profile has independent story progress, settings, and session summaries.
- No account, network request, camera frame, or child voice recording is required.
- Storage behavior is documented, tested, and resilient to malformed or missing data.
- A profile isolation test proves one child cannot see another child’s history.
