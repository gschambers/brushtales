# 015 — Evaluate a sandboxed OpenCode runner

- **Status:** todo
- **Priority:** high
- **Summary:** Evaluate and prototype an opt-in OS-level sandbox for OpenCode and Herdr developer runs.
- **Labels:** developer-experience, security, spike, tooling, workflow
- **Depends on:** 013

## Goal

Add a stronger defense-in-depth boundary around developer-only OpenCode and
Herdr runs. OpenCode permissions and plugins remain useful policy and workflow
controls, but they must not be described as an operating-system sandbox. This
task investigates an explicit, auditable runner that exposes only the intended
BrushTales checkout and approved runtime inputs while preserving review and
approval gates.

## Recommendation to validate

Start with an opt-in rootless Docker or Podman backend because it provides a
portable process/filesystem boundary on Linux and can run through the Linux VM
provided by common macOS container tools. Evaluate Bubblewrap as a possible
Linux-only lightweight backend only after the container contract is proven.
Do not make an OpenCode plugin, macOS App Sandbox entitlement, or host Herdr
socket the security boundary.

## Acceptance criteria

- A short threat model identifies the assets and escape paths in scope,
  including the host home directory, unrelated repositories, Git metadata,
  provider credentials, OpenCode state, Herdr state and sockets, host processes,
  network access, container-engine sockets, and generated logs.
- The study documents the effective limits of OpenCode permissions, plugins,
  `--standalone`, Docker/Podman, Bubblewrap, and macOS-native sandboxing, with
  links to authoritative documentation and an explicit “Implication for
  BrushTales” section.
- A backend decision records supported host/platform combinations, required
  versions, image provenance, rootless/non-root requirements, and clear
  unavailable or unsupported behavior. The runner never silently downgrades to
  unsandboxed mode.
- A concrete runner contract is specified for an invocation carrying the
  canonical project root, exact feature worktree, task ID, absolute delegation
  spec, Herdr mode, and backend. It emits structured redacted lifecycle output
  containing the selected backend, mount/network policy, run identity, and
  cleanup disposition.
- The prototype exposes only the exact feature worktree as writable input. Any
  main checkout, Git common directory, package cache, model asset, or temporary
  directory required for operation is either copied into an isolated image or
  mounted explicitly with a documented read-only boundary; the design does not
  assume that a linked-worktree `.git` file is safe by itself.
- The sandbox does not inherit the host home directory, arbitrary environment
  variables, SSH agent, cloud credentials, provider credential files, Docker or
  Podman sockets, Herdr global socket, unrelated worktrees, devices, or child
  media. Any provider access uses an explicit reviewed mechanism and never
  persists credentials in the image, workspace, logs, or Herdr state.
- The default profile uses a non-root/rootless process, private process and IPC
  namespaces, no host networking, no published ports, dropped capabilities,
  `no-new-privileges`, the runtime’s default seccomp/profile protections, and
  bounded CPU, memory, process, disk, and execution time. Deviations require
  explicit configuration and are surfaced in output.
- The runner and Herdr integration have an explicit boundary decision: either
  Herdr server/workspaces run inside the same sandbox, or a host-side Herdr
  connection is narrowly mediated and documented as a reduced-isolation mode.
  The implementation never mounts or mutates the shared global Herdr socket as
  an implicit convenience.
- Disposable probes demonstrate that a sandboxed run cannot read a sentinel
  outside the mounted project inputs, inspect unrelated host processes, reach
  the network when disabled, or access omitted credentials/sockets. Probes use
  non-secret sentinels and store only redacted results under `tmp/`.
- The runner preserves existing safety gates: exact project/worktree identity,
  adversarial review, approval for Git add/commit/push/PR operations, dirty
  worktree protection, and no child image, camera-frame, voice-recording, or
  other child-media persistence or upload.
- Crash, timeout, cancellation, backend failure, and partial cleanup leave the
  worktree and Herdr ownership records recoverable. Cleanup is owner-bound,
  idempotent, and never stops a shared server or deletes a dirty worktree.
- The result includes a recommendation to implement, defer, or reject each
  backend; a smallest viable implementation plan; operational costs; and a
  follow-up task for implementation if the container approach is accepted.

## Notes

This is developer tooling only and is not part of the Expo mobile runtime. Keep
the existing best-effort OpenCode policy simplification in place while this
task is evaluated. A sandbox can constrain the agent process, but a writable
host checkout still permits intentional or accidental source changes; branch,
worktree, review, and approval controls remain mandatory.

## Sources

- [OpenCode V2 permissions](https://opencode.ai/v2/docs/permissions)
- [OpenCode V2 CLI and standalone server](https://opencode.ai/v2/docs/cli)
- [OpenCode V2 plugins, hooks, and permission API](https://opencode.ai/v2/docs/build/plugins)
- [Docker Engine security](https://docs.docker.com/engine/security/)
- [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/)
- [Docker rootless mode](https://docs.docker.com/engine/security/rootless/)
- [Docker seccomp profiles](https://docs.docker.com/engine/security/seccomp/)
- [Podman run](https://docs.podman.io/en/latest/markdown/podman-run.1.html)
- [Bubblewrap security model](https://raw.githubusercontent.com/containers/bubblewrap/main/README.md)
- [Apple Platform Security](https://support.apple.com/guide/security/welcome/web)
