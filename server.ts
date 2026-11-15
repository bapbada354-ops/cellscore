import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  GoogleGenAI,
  Modality,
  ThinkingLevel,
  type LiveServerMessage,
} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEXT_SYSTEM_INSTRUCTION =
  "You are CellScore's EV battery analyst and advisor for India (2-wheelers & 3-wheelers). Use the provided live dashboard JSON (score, remaining life, residual value, stressors, lender underwriting verdict, fair vehicle price, and any local climate/location data) to answer clearly, accurately, and concisely. Never invent numbers not present in the dashboard state or tool outputs. Do not give regulated financial advice. Keep answers crisp and under 90 words unless the user asks for details.";

function buildLiveSystemInstruction(state: unknown): string {
  return [
    "You are CellScore's real-time voice assistant for used EV batteries in India (2-wheelers and 3-wheelers).",
    'Speak naturally, warmly, and concisely (2–4 short sentences per turn) so responses sound great aloud.',
    'Always ground your answers in the live CellScore dashboard state below (battery score, band, remaining life, residual rupee value, top stressors, lender decision, fair price check, and local climate reading if provided).',
    'Never invent numbers outside this state. Remind the user briefly if asked for regulated financial advice that CellScore provides battery health estimates, not financial advice.',
    `Live dashboard state JSON:\n${JSON.stringify(state ?? {})}`,
  ].join('\n\n');
}

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ParsedClimateFields {
  locationName: string;
  climateProfile: string;
  peakTempRangeC: string;
  suggestedHeatPct: number;
  chargingAdvice: string;
  summary: string;
}

function parseClimateResponseText(rawText: string, fallbackLocation: string): ParsedClimateFields {
  const lines = rawText.split(/\r?\n/);
  const fields: Record<string, string> = {};
  const narrativeLines: string[] = [];

  for (const line of lines) {
    const match = line.match(
      /^(LOCATION_NAME|CLIMATE_PROFILE|PEAK_TEMP_RANGE_C|SUGGESTED_HEAT_PCT|CHARGING_ADVICE)\s*:\s*(.+)$/i,
    );
    if (match) {
      fields[match[1].toUpperCase()] = match[2].trim();
    } else {
      narrativeLines.push(line);
    }
  }

  const rawPct = Number.parseInt((fields.SUGGESTED_HEAT_PCT ?? '').replace(/[^\d]/g, ''), 10);
  const suggestedHeatPct = Number.isFinite(rawPct)
    ? Math.max(0, Math.min(100, rawPct))
    : 25;

  const cleanedSummary = narrativeLines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    locationName: fields.LOCATION_NAME || fallbackLocation,
    climateProfile: fields.CLIMATE_PROFILE || 'Regional thermal estimate',
    peakTempRangeC: fields.PEAK_TEMP_RANGE_C || '32–42°C',
    suggestedHeatPct,
    chargingAdvice:
      fields.CHARGING_ADVICE ||
      'Prefer shaded overnight AC charging and avoid midday fast charging when ambient heat exceeds 38°C.',
    summary: cleanedSummary || rawText.trim(),
  };
}

interface GroundedMapLink {
  title: string;
  uri: string;
  snippets: Array<{ text: string; uri?: string }>;
}

function extractMapGroundingLinks(response: unknown): GroundedMapLink[] {
  const candidates = (response as { candidates?: Array<Record<string, unknown>> })?.candidates;
  const metadata = candidates?.[0]?.groundingMetadata as
    | { groundingChunks?: Array<Record<string, unknown>> }
    | undefined;
  const chunks = metadata?.groundingChunks ?? [];

  const links: GroundedMapLink[] = [];
  const seenUris = new Set<string>();

  for (const chunk of chunks) {
    const maps = chunk?.maps as
      | {
          uri?: string;
          title?: string;
          placeAnswerSources?: {
            reviewSnippets?: Array<{
              uri?: string;
              googleMapsUri?: string;
              title?: string;
              authorAttribution?: { displayName?: string };
              text?: string;
              snippet?: string;
            }>;
          };
        }
      | undefined;

    if (!maps?.uri || seenUris.has(maps.uri)) continue;
    seenUris.add(maps.uri);

    const rawSnippets = maps.placeAnswerSources?.reviewSnippets ?? [];
    const snippets: Array<{ text: string; uri?: string }> = [];
    for (const s of rawSnippets) {
      const snippetText = (s.snippet || s.text || s.title || '').trim();
      const snippetUri = s.googleMapsUri || s.uri;
      if (snippetText || snippetUri) {
        snippets.push({
          text: snippetText || 'Maps review source',
          uri: snippetUri,
        });
      }
    }

    links.push({
      title: (maps.title || 'View on Google Maps').trim(),
      uri: maps.uri,
      snippets,
    });
  }

  return links;
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '128kb' }));

  app.get('/api/health', (_req, res) => {
    const aiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
    res.json({ ok: true, aiConfigured });
  });

  app.post('/api/ask', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({ error: 'Gemini API key unavailable', fallback: true });
      return;
    }

    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    const state = req.body?.state ?? {};
    const rawHistory = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!question) {
      res.status(400).json({ error: 'Question is required', fallback: true });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const ai = createGeminiClient(apiKey);

      const rawList: unknown[] = rawHistory;
      const historyContents = rawList
        .slice(-8)
        .filter(
          (m): m is { role: 'user' | 'assistant'; text: string } =>
            Boolean(m) &&
            typeof (m as { text?: unknown }).text === 'string' &&
            ((m as { role?: unknown }).role === 'user' ||
              (m as { role?: unknown }).role === 'assistant'),
        )
        .map((m: { role: 'user' | 'assistant'; text: string }) => ({
          role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
          parts: [{ text: m.text }],
        }));

      const currentUserMessage = `Current live CellScore dashboard JSON:\n${JSON.stringify(state)}\n\nUser question: ${question}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          ...historyContents,
          { role: 'user', parts: [{ text: currentUserMessage }] },
        ],
        config: {
          systemInstruction: TEXT_SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          abortSignal: controller.signal,
        },
      });

      const text = response.text?.trim();
      if (!text) {
        res.status(502).json({ error: 'Empty response', fallback: true });
        return;
      }

      res.json({ answer: text });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Assistant request failed';
      res.status(502).json({ error: message, fallback: true });
    } finally {
      clearTimeout(timeoutId);
    }
  });

  app.post('/api/climate-location', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        error: 'Gemini API key unavailable. Configure GEMINI_API_KEY in Secrets to enable Google Maps climate grounding.',
      });
      return;
    }

    const latitude =
      typeof req.body?.latitude === 'number' && Number.isFinite(req.body.latitude)
        ? req.body.latitude
        : null;
    const longitude =
      typeof req.body?.longitude === 'number' && Number.isFinite(req.body.longitude)
        ? req.body.longitude
        : null;
    const locationQuery =
      typeof req.body?.locationQuery === 'string' ? req.body.locationQuery.trim() : '';
    const vehicleType = req.body?.vehicleType === '3W' ? '3-Wheeler' : '2-Wheeler';
    const chemistry = req.body?.chemistry === 'NMC' ? 'NMC' : 'LFP';

    if ((latitude === null || longitude === null) && !locationQuery) {
      res.status(400).json({
        error: 'Provide GPS coordinates or enter a city/area name to check local climate.',
      });
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 16000);

    try {
      const ai = createGeminiClient(apiKey);
      const locationDescriptor =
        locationQuery ||
        `coordinates (${latitude?.toFixed(4)}, ${longitude?.toFixed(4)})`;

      const prompt = [
        `Using Google Maps location data for ${locationDescriptor}:`,
        `1. Identify the city/neighborhood and notable EV two-wheeler / three-wheeler charging points nearby.`,
        `2. Assess the local climate and typical daytime/summer ambient temperatures there, and explain how those temperatures affect EV ${vehicleType} (${chemistry}) battery charging and pack thermal exposure above 40°C.`,
        `3. Write a concise 2–3 sentence thermal & charging reading in plain language.`,
        `4. At the end of your response, include these exact 5 metadata lines (one per line, no markdown bullets or bolding):`,
        `LOCATION_NAME: <City, State or Locality>`,
        `CLIMATE_PROFILE: <2-4 word climate summary, e.g. Hot semi-arid summer>`,
        `PEAK_TEMP_RANGE_C: <typical warm/peak daytime °C range, e.g. 37-44°C>`,
        `SUGGESTED_HEAT_PCT: <single integer 0-100 estimating % of charging/riding time pack runs above 40°C here>`,
        `CHARGING_ADVICE: <1 short sentence on best charging window/rate for this climate>`,
      ].join('\n');

      const config: {
        tools: Array<{ googleMaps: Record<string, never> }>;
        toolConfig?: { retrievalConfig: { latLng: { latitude: number; longitude: number } } };
        abortSignal: AbortSignal;
      } = {
        tools: [{ googleMaps: {} }],
        abortSignal: controller.signal,
      };

      if (latitude !== null && longitude !== null) {
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude,
              longitude,
            },
          },
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config,
      });

      const rawText = response.text?.trim();
      if (!rawText) {
        res.status(502).json({ error: 'Empty response from Google Maps grounding.' });
        return;
      }

      const parsed = parseClimateResponseText(rawText, locationDescriptor);
      const mapLinks = extractMapGroundingLinks(response);

      res.json({
        ...parsed,
        mapLinks,
        latitude,
        longitude,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to fetch Google Maps climate reading.';
      res.status(502).json({ error: message });
    } finally {
      clearTimeout(timeoutId);
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const httpServer = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const requestUrl = request.url ?? '';
    if (requestUrl.startsWith('/api/live')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (clientWs: WebSocket) => {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      clientWs.send(
        JSON.stringify({
          type: 'error',
          message: 'Gemini API key is not configured for Live voice conversations.',
        }),
      );
      clientWs.close();
      return;
    }

    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let isConnecting = false;
    let closed = false;

    const sendJson = (payload: Record<string, unknown>) => {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(JSON.stringify(payload));
      }
    };

    const connectLiveSession = async (initialState: unknown) => {
      if (liveSession || isConnecting || closed) return;
      isConnecting = true;
      try {
        const ai = createGeminiClient(apiKey);
        liveSession = await ai.live.connect({
          model: 'gemini-3.8-live',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: 'Zephyr',
                },
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: buildLiveSystemInstruction(initialState),
          },
          callbacks: {
            onopen: () => {
              sendJson({ type: 'ready' });
            },
            onmessage: (message: LiveServerMessage) => {
              const content = message.serverContent;
              if (content?.inputTranscription?.text) {
                sendJson({
                  type: 'inputTranscript',
                  text: content.inputTranscription.text,
                });
              }
              if (content?.outputTranscription?.text) {
                sendJson({
                  type: 'outputTranscript',
                  text: content.outputTranscription.text,
                });
              }
              for (const part of content?.modelTurn?.parts ?? []) {
                if (part.inlineData?.data) {
                  sendJson({
                    type: 'audio',
                    data: part.inlineData.data,
                  });
                }
              }
              if (content?.interrupted) {
                sendJson({ type: 'interrupted' });
              }
              if (content?.turnComplete) {
                sendJson({ type: 'turnComplete' });
              }
            },
            onerror: (err: unknown) => {
              const msg =
                err instanceof Error
                  ? err.message
                  : 'Gemini Live session encountered an error.';
              sendJson({ type: 'error', message: msg });
            },
            onclose: () => {
              liveSession = null;
              if (!closed) {
                sendJson({ type: 'closed' });
              }
            },
          },
        });
        if (closed && liveSession) {
          liveSession.close();
          liveSession = null;
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to connect to Gemini Live API.';
        sendJson({ type: 'error', message: msg });
        clientWs.close();
      } finally {
        isConnecting = false;
      }
    };

    clientWs.on('message', (rawData) => {
      try {
        const parsed = JSON.parse(rawData.toString()) as {
          type?: string;
          state?: unknown;
          data?: string;
          text?: string;
        };

        if (parsed.type === 'init') {
          void connectLiveSession(parsed.state ?? {});
          return;
        }

        if (parsed.type === 'audio' && parsed.data && liveSession) {
          liveSession.sendRealtimeInput({
            audio: {
              data: parsed.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
          return;
        }

        if (parsed.type === 'text' && parsed.text && liveSession) {
          liveSession.sendRealtimeInput({
            text: parsed.text,
          });
          return;
        }

        if (parsed.type === 'state' && parsed.state && liveSession) {
          liveSession.sendRealtimeInput({
            text: `[Context update — do not reply unless asked: live CellScore state is now ${JSON.stringify(parsed.state)}]`,
          });
        }
      } catch {
        // Ignore malformed client frames
      }
    });

    clientWs.on('close', () => {
      closed = true;
      if (liveSession) {
        try {
          liveSession.close();
        } catch {
          // ignore close error
        }
        liveSession = null;
      }
    });
  });

  return httpServer;
}

const PORT = Number(process.env.PORT) || 3000;

createApp()
  .then((httpServer) => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`CellScore server listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start CellScore server:', err);
    process.exit(1);
  });
