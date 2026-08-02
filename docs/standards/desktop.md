# Desktop application standards

- Act as composition root for runtime, AI services, persistence, workspace tools, and host
  integrations.
- Keep renderer code separate from privileged desktop and engine code. Communicate across that
  boundary with plain serializable commands, events, and snapshots.
- Keep application and operating-system lifecycle policy here rather than pushing it into runtime or
  AI packages.
- Keep components feature-local until multiple real consumers establish a reusable visual or
  behavioral primitive.
- Do not place reusable domain validation, serialization, credential, or runtime policy inside UI
  components or desktop entry points.
