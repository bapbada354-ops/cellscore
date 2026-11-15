import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AudioLines,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  Mic,
  MicOff,
  SendHorizontal,
  X,
} from 'lucide-react';
import {
  answerAssistantChip,
  getAssistantChips,
  matchClosestChipId,
  type AssistantChipId,
  type AssistantSharedState,
  type ClimateLocationReading,
  type GroundedMapLink,
} from '../config/assistantEngine';
import {
  fetchClimateLocationReading,
  getBrowserCoordinates,
} from '../utils/climateClient';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isAiGenerated?: boolean;
  isVoice?: boolean;
  mapLinks?: GroundedMapLink[];
}

type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

interface AskCellScoreDrawerProps {
  sharedState: AssistantSharedState;
  aiConfigured?: boolean;
  onClimateReadingChange?: (reading: ClimateLocationReading) => void;
  onApplyClimateHeatPct?: (pct: number) => void;
}

function float32ToPcm16Base64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const float32 = new Float32Array(sampleCount);
  for (let i = 0; i < sampleCount; i += 1) {
    float32[i] = view.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

export function AskCellScoreDrawer({
  sharedState,
  aiConfigured = false,
  onClimateReadingChange,
  onApplyClimateHeatPct,
}: AskCellScoreDrawerProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Refs for WebSocket & AudioWorklet/ScriptProcessor (prevents stale closures)
  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sharedStateRef = useRef<AssistantSharedState>(sharedState);
  const liveUserMsgIdRef = useRef<string | null>(null);
  const liveAssistantMsgIdRef = useRef<string | null>(null);
  const speakingTimerRef = useRef<number | null>(null);

  sharedStateRef.current = sharedState;
  const chips = getAssistantChips(sharedState);

  const stopPlaybackQueue = useCallback(() => {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore stopped nodes
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const stopVoiceSession = useCallback(
    (preserveError = false) => {
      if (speakingTimerRef.current !== null) {
        window.clearTimeout(speakingTimerRef.current);
        speakingTimerRef.current = null;
      }

      if (processorRef.current) {
        try {
          processorRef.current.disconnect();
        } catch {
          // ignore
        }
        processorRef.current.onaudioprocess = null;
        processorRef.current = null;
      }

      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch {
          // ignore
        }
        sourceNodeRef.current = null;
      }

      if (mediaStreamRef.current) {
        for (const track of mediaStreamRef.current.getTracks()) {
          track.stop();
        }
        mediaStreamRef.current = null;
      }

      if (inputAudioCtxRef.current) {
        void inputAudioCtxRef.current.close().catch(() => undefined);
        inputAudioCtxRef.current = null;
      }

      stopPlaybackQueue();

      if (outputAudioCtxRef.current) {
        void outputAudioCtxRef.current.close().catch(() => undefined);
        outputAudioCtxRef.current = null;
      }

      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {
          // ignore
        }
        wsRef.current = null;
      }

      liveUserMsgIdRef.current = null;
      liveAssistantMsgIdRef.current = null;

      if (!preserveError) {
        setVoiceError(null);
        setVoiceStatus('idle');
      }
    },
    [stopPlaybackQueue],
  );

  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, [stopVoiceSession]);

  useEffect(() => {
    if (!open || !aiConfigured) {
      stopVoiceSession();
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, stopVoiceSession]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, isLocating, open, voiceStatus]);

  const scheduleAudioChunk = useCallback((base64Audio: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    const samples = base64Pcm16ToFloat32(base64Audio);
    if (samples.length === 0) return;

    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.copyToChannel(new Float32Array(samples), 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  }, []);

  const appendLiveTranscript = useCallback(
    (role: 'user' | 'assistant', chunkText: string) => {
      const cleaned = chunkText;
      if (!cleaned) return;

      const ref = role === 'user' ? liveUserMsgIdRef : liveAssistantMsgIdRef;
      const otherRef = role === 'user' ? liveAssistantMsgIdRef : liveUserMsgIdRef;
      otherRef.current = null;

      if (!ref.current) {
        const newId = `v-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        ref.current = newId;
        setMessages((prev) => [
          ...prev,
          {
            id: newId,
            role,
            text: cleaned.trimStart(),
            isAiGenerated: role === 'assistant',
            isVoice: true,
          },
        ]);
      } else {
        const targetId = ref.current;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === targetId
              ? {
                  ...m,
                  text: `${m.text}${m.text && !m.text.endsWith(' ') && !cleaned.startsWith(' ') ? ' ' : ''}${cleaned}`,
                }
              : m,
          ),
        );
      }
    },
    [],
  );

  const startVoiceSession = async () => {
    if (!aiConfigured) return;
    if (voiceStatus === 'connecting' || voiceStatus === 'listening' || voiceStatus === 'speaking') {
      stopVoiceSession();
      return;
    }

    setVoiceError(null);
    setVoiceStatus('connecting');

    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;

      if (inputCtx.state === 'suspended') {
        await inputCtx.resume();
      }
      if (outputCtx.state === 'suspended') {
        await outputCtx.resume();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/api/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'init', state: sharedStateRef.current }));

        const source = inputCtx.createMediaStreamSource(stream);
        const processor = inputCtx.createScriptProcessor(4096, 1, 1);
        sourceNodeRef.current = source;
        processorRef.current = processor;

        processor.onaudioprocess = (event) => {
          const currentWs = wsRef.current;
          if (!currentWs || currentWs.readyState !== WebSocket.OPEN) return;
          const channelData = event.inputBuffer.getChannelData(0);
          const base64Audio = float32ToPcm16Base64(channelData);
          currentWs.send(JSON.stringify({ type: 'audio', data: base64Audio }));
        };

        source.connect(processor);
        processor.connect(inputCtx.destination);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type?: string;
            data?: string;
            text?: string;
            message?: string;
          };

          if (msg.type === 'ready') {
            setVoiceStatus('listening');
            return;
          }

          if (msg.type === 'audio' && msg.data) {
            setVoiceStatus('speaking');
            scheduleAudioChunk(msg.data);
            if (speakingTimerRef.current !== null) {
              window.clearTimeout(speakingTimerRef.current);
            }
            speakingTimerRef.current = window.setTimeout(() => {
              setVoiceStatus((prev) => (prev === 'speaking' ? 'listening' : prev));
            }, 900);
            return;
          }

          if (msg.type === 'inputTranscript' && msg.text) {
            appendLiveTranscript('user', msg.text);
            return;
          }

          if (msg.type === 'outputTranscript' && msg.text) {
            appendLiveTranscript('assistant', msg.text);
            return;
          }

          if (msg.type === 'interrupted') {
            stopPlaybackQueue();
            liveAssistantMsgIdRef.current = null;
            setVoiceStatus('listening');
            return;
          }

          if (msg.type === 'turnComplete') {
            liveUserMsgIdRef.current = null;
            liveAssistantMsgIdRef.current = null;
            setVoiceStatus((prev) => (prev === 'speaking' ? 'listening' : prev));
            return;
          }

          if (msg.type === 'error') {
            setVoiceError(msg.message || 'Voice conversation encountered an error.');
            setVoiceStatus('error');
            stopVoiceSession(true);
            return;
          }

          if (msg.type === 'closed') {
            stopVoiceSession();
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onerror = () => {
        setVoiceError('Could not connect to live voice server. Try again.');
        setVoiceStatus('error');
        stopVoiceSession(true);
      };

      ws.onclose = () => {
        setVoiceStatus((prev) => (prev === 'error' ? 'error' : 'idle'));
      };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to start live voice conversation.';
      setVoiceError(msg);
      setVoiceStatus('error');
      stopVoiceSession(true);
    }
  };

  // Keep live Gemini session aware if shared state updates mid-conversation
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && (voiceStatus === 'listening' || voiceStatus === 'speaking')) {
      ws.send(JSON.stringify({ type: 'state', state: sharedState }));
    }
  }, [sharedState, voiceStatus]);

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const pushChipConversation = (userLabel: string, chipId: AssistantChipId) => {
    const answerText = answerAssistantChip(chipId, sharedState, aiConfigured);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: userLabel,
    };

    setMessages((prev) => [...prev, userMsg]);

    if (prefersReducedMotion) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: answerText,
        },
      ]);
      return;
    }

    setIsTyping(true);
    window.setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: answerText,
        },
      ]);
    }, 240);
  };

  const handleChipClick = (chipId: AssistantChipId, label: string) => {
    if (isTyping || isLocating) return;
    pushChipConversation(label, chipId);
  };

  const handleShareLocationClimate = async () => {
    if (!aiConfigured || isLocating || isTyping) return;
    setIsLocating(true);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: 'Check my location climate & charging reading',
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const coords = await getBrowserCoordinates();
      const reading = await fetchClimateLocationReading({
        latitude: coords.latitude,
        longitude: coords.longitude,
        vehicleType: sharedState.input.vehicleType,
        chemistry: sharedState.input.chemistry,
      });

      onClimateReadingChange?.(reading);

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: `${reading.locationName} (${reading.climateProfile}, peak ${reading.peakTempRangeC}): ${reading.summary} Suggested "Time above 40°C": ${reading.suggestedHeatPct}%. ${reading.chargingAdvice}`,
          isAiGenerated: true,
          mapLinks: reading.mapLinks,
        },
      ]);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Unable to check local climate. You can enter a city on the Score tab.';
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: errorMessage,
        },
      ]);
    } finally {
      setIsLocating(false);
    }
  };

  const handleSubmitQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isTyping) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      text: trimmed,
    };

    const historySnapshot = messages.slice(-8).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    setInputText('');
    setMessages((prev) => [...prev, userMsg]);

    if (!aiConfigured) {
      const fallbackChipId = matchClosestChipId(trimmed);
      const fallbackText = answerAssistantChip(fallbackChipId, sharedState, false);
      if (prefersReducedMotion) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            text: fallbackText,
          },
        ]);
        return;
      }
      setIsTyping(true);
      window.setTimeout(() => {
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            text: fallbackText,
          },
        ]);
      }, 240);
      return;
    }

    setIsTyping(true);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          history: historySnapshot,
          state: sharedState,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error('Fallback to local template');
      }

      const data = (await response.json()) as { answer?: string };
      const answer = typeof data.answer === 'string' ? data.answer.trim() : '';
      if (!answer) {
        throw new Error('Empty AI answer');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: answer,
          isAiGenerated: true,
        },
      ]);
    } catch {
      const fallbackChipId = matchClosestChipId(trimmed);
      const fallbackText = answerAssistantChip(fallbackChipId, sharedState, aiConfigured);
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          text: fallbackText,
        },
      ]);
    } finally {
      window.clearTimeout(timeoutId);
      setIsTyping(false);
    }
  };

  const isVoiceActive =
    voiceStatus === 'connecting' || voiceStatus === 'listening' || voiceStatus === 'speaking';

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Ask CellScore assistant"
        className="cs-no-print fixed bottom-[70px] right-4 md:bottom-6 md:right-6 z-40 h-11 px-4 rounded-full cs-cta-primary font-display font-semibold text-xs sm:text-sm inline-flex items-center gap-2 hover:opacity-95 active:scale-[0.98] transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]"
        style={{ boxShadow: 'var(--cta-shadow)' }}
      >
        <MessageSquare className="w-4 h-4" aria-hidden="true" />
        <span>Ask CellScore</span>
      </button>

      {/* Drawer Portal */}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="cs-no-print fixed inset-0 z-[9990] bg-[var(--bg-backdrop)] backdrop-blur-sm flex justify-end items-end sm:items-stretch"
              role="dialog"
              aria-modal="true"
              aria-labelledby="ask-cellscore-title"
              onClick={() => setOpen(false)}
            >
              <aside
                className="w-full sm:w-[440px] h-[86dvh] sm:h-full bg-[var(--bg-elevated)] border-t sm:border-t-0 sm:border-l border-[var(--border-strong)] rounded-t-[20px] sm:rounded-none sm:rounded-l-[20px] flex flex-col overflow-hidden shadow-2xl text-[var(--text-primary)]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="px-5 py-4 border-b border-[var(--border-glass)] flex items-center justify-between gap-3 shrink-0">
                  <div className="min-w-0">
                    <h2
                      id="ask-cellscore-title"
                      className="font-display text-base font-semibold text-[var(--text-primary)]"
                    >
                      Ask CellScore
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] tabular-nums truncate">
                      {sharedState.activeBatteryLabel} · Score {sharedState.scoreResult.score} (
                      {sharedState.scoreResult.band.label})
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {aiConfigured ? (
                      <button
                        type="button"
                        onClick={startVoiceSession}
                        aria-pressed={isVoiceActive}
                        aria-label={
                          isVoiceActive
                            ? 'Stop Gemini Live voice conversation'
                            : 'Start Gemini Live voice conversation'
                        }
                        className={`h-9 px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 ${
                          isVoiceActive
                            ? 'bg-[var(--status-poor-bg)] border-[var(--status-poor-border)] text-[var(--status-poor)]'
                            : 'bg-[var(--status-good-bg)] border-[var(--status-good-border)] text-[var(--status-good)] hover:opacity-90'
                        }`}
                      >
                        {voiceStatus === 'connecting' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : isVoiceActive ? (
                          <MicOff className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <Mic className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>{isVoiceActive ? 'End voice' : 'Voice Live'}</span>
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label="Close Ask CellScore"
                      className="w-9 h-9 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-control-hover)] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Live Voice Status Banner */}
                {aiConfigured && isVoiceActive ? (
                  <div className="px-5 py-2.5 bg-[var(--status-good-bg)] border-b border-[var(--status-good-border)] flex items-center justify-between gap-2 text-xs shrink-0">
                    <div className="flex items-center gap-2 text-[var(--status-good)] font-medium">
                      <AudioLines className="w-4 h-4 animate-pulse shrink-0" aria-hidden="true" />
                      <span>
                        {voiceStatus === 'connecting'
                          ? 'Connecting Gemini Live voice...'
                          : voiceStatus === 'speaking'
                            ? 'CellScore is speaking...'
                            : 'Listening — speak naturally'}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.08em] font-semibold text-[var(--text-secondary)]">
                      Live Audio
                    </span>
                  </div>
                ) : null}

                {aiConfigured && voiceError ? (
                  <div className="px-5 py-2.5 bg-[var(--status-poor-bg)] border-b border-[var(--status-poor-border)] text-xs text-[var(--status-poor)] flex items-center justify-between gap-2 shrink-0">
                    <span>{voiceError}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setVoiceError(null);
                        setVoiceStatus('idle');
                      }}
                      className="underline font-semibold shrink-0 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                ) : null}

                {/* Conversation Area */}
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4">
                  {/* Greeting Bubble */}
                  <div className="rounded-2xl rounded-tl-sm bg-[var(--surface-tile)] border border-[var(--border-glass)] p-3.5 text-xs sm:text-sm text-[var(--text-primary)] leading-relaxed">
                    {aiConfigured ? (
                      <>
                        Hi — ask by typing, tap <span className="font-semibold">Voice Live</span>{' '}
                        for a real-time Gemini voice conversation, or share your location for local
                        climate charging context.
                      </>
                    ) : (
                      'Hi — ask a question below or tap any prompt to inspect your live battery score, lender decision, or fair price.'
                    )}
                  </div>

                  {/* Quick Actions: Location Check + Question Chips */}
                  <div className="flex flex-wrap gap-2">
                    {aiConfigured ? (
                      <button
                        type="button"
                        onClick={handleShareLocationClimate}
                        disabled={isLocating || isTyping}
                        className="px-3 py-1.5 rounded-full bg-[var(--status-cyan-bg)] border border-[var(--status-cyan-border)] text-xs font-semibold text-[var(--accent-cyan)] hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-cyan)]/60"
                      >
                        {isLocating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>
                          {sharedState.climate
                            ? `Refresh climate (${sharedState.climate.locationName})`
                            : 'Share location for climate reading'}
                        </span>
                      </button>
                    ) : null}

                    {chips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => handleChipClick(chip.id, chip.label)}
                        disabled={isTyping || isLocating}
                        className="px-3 py-1.5 rounded-full bg-[var(--surface-control)] border border-[var(--border-control)] text-xs font-medium text-[var(--text-primary)] hover:border-[var(--status-good-border)] hover:bg-[var(--status-good-bg)] transition-colors text-left cursor-pointer disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Active Climate Context Badge inside Drawer */}
                  {aiConfigured && sharedState.climate ? (
                    <div className="rounded-xl bg-[var(--surface-tile)] border border-[var(--status-cyan-border)] p-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[var(--text-primary)]">
                          Climate calibrated: {sharedState.climate.locationName}
                        </span>
                        {onApplyClimateHeatPct ? (
                          <button
                            type="button"
                            onClick={() =>
                              onApplyClimateHeatPct(sharedState.climate!.suggestedHeatPct)
                            }
                            className="text-[11px] font-semibold text-[var(--accent-mint)] underline underline-offset-2 cursor-pointer"
                          >
                            Apply {sharedState.climate.suggestedHeatPct}% &gt;40°C
                          </button>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        {sharedState.climate.climateProfile} · Peak{' '}
                        {sharedState.climate.peakTempRangeC} · Est.{' '}
                        {sharedState.climate.suggestedHeatPct}% time &gt;40°C
                      </p>
                    </div>
                  ) : null}

                  {/* Chat History */}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      } space-y-1.5`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'rounded-tr-sm cs-seg-active border text-[var(--text-primary)]'
                            : 'rounded-tl-sm bg-[var(--surface-tile)] border border-[var(--border-glass)] text-[var(--text-primary)]'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {msg.mapLinks && msg.mapLinks.length > 0 ? (
                        <div className="max-w-[90%] flex flex-wrap gap-1.5 px-1">
                          {msg.mapLinks.map((link) => (
                            <a
                              key={link.uri}
                              href={link.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--surface-control)] border border-[var(--border-control)] text-[11px] text-[var(--accent-cyan)] hover:border-[var(--accent-cyan)]"
                            >
                              <span>{link.title}</span>
                              <ExternalLink className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                            </a>
                          ))}
                        </div>
                      ) : null}

                      {msg.isAiGenerated ? (
                        <span className="text-[11px] text-[var(--accent-mint)] px-1">
                          {msg.isVoice
                            ? 'Gemini Live voice response'
                            : 'Grounded in live CellScore data'}
                        </span>
                      ) : null}
                    </div>
                  ))}

                  {/* Typing / Locating Indicator */}
                  {isTyping || isLocating ? (
                    <div className="flex items-start">
                      <div className="rounded-2xl rounded-tl-sm bg-[var(--surface-tile)] border border-[var(--border-glass)] px-4 py-3 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:-0.2s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:-0.1s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" />
                      </div>
                    </div>
                  ) : null}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input Box & Footer */}
                <div className="px-5 py-3.5 border-t border-[var(--border-glass)] space-y-2.5 shrink-0 bg-[var(--bg-elevated-alt)]">
                  <form onSubmit={handleSubmitQuestion} className="flex items-center gap-2">
                    <label htmlFor="ask-cellscore-input" className="sr-only">
                      Ask a question about this battery
                    </label>
                    <input
                      ref={inputRef}
                      id="ask-cellscore-input"
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Ask about score, climate, loans, or price..."
                      disabled={isTyping}
                      className="flex-1 min-w-0 h-10 px-3.5 rounded-xl bg-[var(--surface-control)] border border-[var(--border-control)] text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 disabled:opacity-60"
                    />
                    {aiConfigured ? (
                      <button
                        type="button"
                        onClick={startVoiceSession}
                        aria-label={isVoiceActive ? 'Stop voice mode' : 'Start voice mode'}
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]/60 ${
                          isVoiceActive
                            ? 'bg-[var(--status-poor-bg)] border-[var(--status-poor-border)] text-[var(--status-poor)]'
                            : 'bg-[var(--surface-control)] border-[var(--border-control)] text-[var(--text-primary)] hover:bg-[var(--surface-control-hover)]'
                        }`}
                      >
                        {isVoiceActive ? (
                          <MicOff className="w-4 h-4" aria-hidden="true" />
                        ) : (
                          <Mic className="w-4 h-4" aria-hidden="true" />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={isTyping || !inputText.trim()}
                      aria-label="Send question"
                      className="w-10 h-10 rounded-xl cs-cta-primary flex items-center justify-center shrink-0 hover:opacity-95 disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]"
                    >
                      <SendHorizontal className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </form>

                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {aiConfigured
                      ? 'Explanations combine your live numbers, Gemini AI, and Google Maps climate context. Not financial advice.'
                      : 'Explanations are grounded in your live CellScore numbers. Not financial advice.'}
                  </p>
                </div>
              </aside>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
