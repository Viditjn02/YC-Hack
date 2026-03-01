let ctx: AudioContext | null = null;
let activePanner: PannerNode | null = null;
let activeAgentId: string | null = null;
let activeSource: AudioBufferSourceNode | null = null;

/** Returns the singleton AudioContext, creating it if needed. Resumes if suspended. */
export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/** Returns the AudioContext if it already exists, null otherwise. Safe for per-frame checks. */
export function peekAudioContext(): AudioContext | null {
  return ctx;
}

export function setActivePanner(panner: PannerNode | null, agentId: string | null) {
  activePanner = panner;
  activeAgentId = agentId;
}

export function getActivePanner(): PannerNode | null {
  return activePanner;
}

export function getActiveAgentId(): string | null {
  return activeAgentId;
}

export function setActiveSource(source: AudioBufferSourceNode | null) {
  activeSource = source;
}

export function getActiveSource(): AudioBufferSourceNode | null {
  return activeSource;
}
