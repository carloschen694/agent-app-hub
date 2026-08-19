import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIVE_CONNECT_TIMEOUT_MS, startLiveInteraction } from './liveInteractionService';

describe('startLiveInteraction client authentication', () => {
  beforeEach(() => installMediaFakes());

  it('uses v1alpha for an ephemeral credential', async () => {
    const { GoogleGenAICtor } = createSdkFake();
    const interaction = await startLiveInteraction(baseOptions({
      apiVersion: 'v1alpha',
      GoogleGenAICtor,
    }));
    expect(GoogleGenAICtor).toHaveBeenCalledWith({
      apiKey: 'ephemeral-secret',
      httpOptions: { apiVersion: 'v1alpha' },
    });
    interaction.stop();
  });

  it('does not force v1alpha for a direct credential', async () => {
    const { GoogleGenAICtor } = createSdkFake();
    const interaction = await startLiveInteraction(baseOptions({ GoogleGenAICtor }));
    expect(GoogleGenAICtor).toHaveBeenCalledWith({ apiKey: 'ephemeral-secret' });
    interaction.stop();
  });

  it('resumes a recoverable close with the same client and token', async () => {
    const { GoogleGenAICtor, connect, callbacks } = createSdkFake();
    const interaction = await startLiveInteraction(baseOptions({
      apiVersion: 'v1alpha',
      GoogleGenAICtor,
    }));

    await callbacks[0].onmessage({
      sessionResumptionUpdate: { handle: 'resume-handle' },
    });
    callbacks[0].onclose();
    await vi.waitFor(() => expect(connect).toHaveBeenCalledTimes(2));

    expect(GoogleGenAICtor).toHaveBeenCalledTimes(1);
    expect(connect.mock.calls[1][0].config.sessionResumption).toEqual({
      handle: 'resume-handle',
    });
    interaction.stop();
  });

  it('does not reconnect after manual stop', async () => {
    const { GoogleGenAICtor, connect, callbacks } = createSdkFake();
    const interaction = await startLiveInteraction(baseOptions({ GoogleGenAICtor }));
    await callbacks[0].onmessage({
      sessionResumptionUpdate: { handle: 'resume-handle' },
    });
    interaction.stop();
    callbacks[0].onclose();
    await Promise.resolve();
    expect(connect).toHaveBeenCalledTimes(1);
  });

  describe('connection failure reporting', () => {
    // Plain fake timers, never advanced in the first test: the dangling
    // 15s connection-timeout timer this creates simply never fires within
    // the test, instead of racing against real wall-clock time.
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('reports an error when the socket closes before ever opening (e.g. an expired or invalid credential)', async () => {
      const onError = vi.fn();
      const onStatusChange = vi.fn();
      const { GoogleGenAICtor, callbacks } = createSdkFake({ autoOpen: false });

      // The connect() promise never resolves until the connection timeout
      // fires; this test never advances fake time that far, so it's safe
      // to leave un-awaited here.
      void startLiveInteraction(baseOptions({
        GoogleGenAICtor,
        callbacks: { onError, onStatusChange },
      }));

      await flushMicrotasksUntil(() => callbacks.length === 1);
      callbacks[0].onclose({ reason: 'invalid api key' });
      await flushMicrotasksUntil(() => onError.mock.calls.length === 1);

      expect(onStatusChange).toHaveBeenCalledWith('error');
      expect(String(onError.mock.calls[0][0])).toContain('invalid api key');
    });

    it('times out instead of hanging forever when the SDK never opens or closes the socket', async () => {
      const { GoogleGenAICtor } = createSdkFake({ autoOpen: false });
      // Attach a handler synchronously, before any fake-timer advancement,
      // so the eventual rejection is never briefly "unhandled" in-between.
      const outcome = startLiveInteraction(baseOptions({ GoogleGenAICtor })).then(
        () => { throw new Error('expected startLiveInteraction to reject'); },
        (error: unknown) => error
      );

      await vi.advanceTimersByTimeAsync(LIVE_CONNECT_TIMEOUT_MS + 1000);

      const error = await outcome;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toMatch(/逾時/);
    });
  });
});

/** Drains the microtask queue (no dependency on real or fake timers) until `predicate` holds. */
async function flushMicrotasksUntil(predicate: () => boolean, maxTicks = 50) {
  for (let i = 0; i < maxTicks && !predicate(); i += 1) {
    await Promise.resolve();
  }
}

function baseOptions(overrides: Record<string, unknown>) {
  return {
    apiKey: 'ephemeral-secret',
    model: 'live-model',
    systemPrompt: 'test',
    tools: [],
    ...overrides,
  } as any;
}

function createSdkFake({ autoOpen = true }: { autoOpen?: boolean } = {}) {
  const sessions: Array<Record<string, ReturnType<typeof vi.fn>>> = [];
  const callbacks: any[] = [];
  const connect = vi.fn(({ callbacks: nextCallbacks }) => {
    callbacks.push(nextCallbacks);
    // A real connection never resolves this promise until onopen fires (see
    // the SDK's own connect() implementation) — deliberately not resolving
    // it here reproduces that when autoOpen is false, so onclose can be
    // exercised without the connect() promise ever settling on its own.
    return new Promise((resolve) => {
      if (!autoOpen) return;
      nextCallbacks.onopen?.();
      const session = {
        sendRealtimeInput: vi.fn(),
        sendToolResponse: vi.fn(),
        close: vi.fn(),
      };
      sessions.push(session);
      resolve(session);
    });
  });
  const GoogleGenAICtor = vi.fn(function GoogleGenAIFake(this: any) {
    this.live = { connect };
  });
  return { GoogleGenAICtor, connect, callbacks, sessions };
}

function installMediaFakes() {
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
  const processor = { ...node(), port: { onmessage: null } };
  const audioContext = {
    sampleRate: 48_000,
    currentTime: 0,
    destination: {},
    audioWorklet: { addModule: vi.fn(async () => {}) },
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
    createMediaStreamSource: vi.fn(node),
    createGain: vi.fn(() => ({ ...node(), gain: { value: 1 } })),
    createBuffer: vi.fn(),
    createBufferSource: vi.fn(),
  };
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: vi.fn() }] })),
    },
  });
  class AudioContextFake {
    constructor() {
      Object.assign(this, audioContext);
    }
  }
  class AudioWorkletNodeFake {
    constructor() {
      return processor;
    }
  }
  vi.stubGlobal('AudioContext', AudioContextFake);
  vi.stubGlobal('AudioWorkletNode', AudioWorkletNodeFake);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn(),
  });
  vi.stubGlobal('Blob', class BlobFake {});
}
