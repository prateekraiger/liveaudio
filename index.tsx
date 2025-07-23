/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GoogleGenAI,
  LiveServerMessage,
  Modality,
  Session,
} from "@google/genai";
import { useState, useRef, useCallback, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { createBlob, decode, decodeAudioData } from "./utils";
import { GdmLiveAudioVisuals3D } from "./visual-3d";

const workletCode = `
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0 && input[0].length > 0) {
      // Post a copy of the Float32Array, not the original, as the
      // underlying memory is reused by the browser.
      this.port.postMessage(input[0].slice(0));
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`;

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState(
    "Click Start to begin the conversation."
  );
  const [error, setError] = useState("");

  const [audioGraph] = useState(() => {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const inputCtx = new Ctx({
      sampleRate: 16000,
    });
    const outputCtx = new Ctx({
      sampleRate: 24000,
    });
    const inputGain = inputCtx.createGain();
    const outputGain = outputCtx.createGain();
    outputGain.connect(outputCtx.destination);
    return { inputCtx, outputCtx, inputGain, outputGain };
  });

  const client = useRef<GoogleGenAI | null>(null);
  const session = useRef<Session | null>(null);

  const nextStartTime = useRef(0);
  const mediaStream = useRef<MediaStream | null>(null);
  const sourceNode = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNode = useRef<AudioWorkletNode | null>(null);
  const sources = useRef(new Set<AudioBufferSourceNode>());

  const isRecordingRef = useRef(isRecording);
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current && !mediaStream.current) return;
    setStatus("Stopping recording...");
    setIsRecording(false);

    if (workletNode.current) {
      workletNode.current.port.onmessage = null;
      workletNode.current.disconnect();
      workletNode.current = null;
    }
    if (sourceNode.current) {
      sourceNode.current.disconnect();
      sourceNode.current = null;
    }

    if (mediaStream.current) {
      mediaStream.current.getTracks().forEach((track) => track.stop());
      mediaStream.current = null;
    }

    session.current?.close();
    session.current = null;
    setStatus("Recording stopped. Click Start to begin again.");
  }, []);

  const startAudioCapture = useCallback(async () => {
    if (!mediaStream.current || !session.current) {
      console.error("Audio capture prerequisites not met.");
      setStatus("Error: Audio capture prerequisites not met.");
      return;
    }

    try {
      await audioGraph.inputCtx.resume();

      const { inputCtx, inputGain } = audioGraph;
      const blob = new Blob([workletCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await inputCtx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      workletNode.current = new AudioWorkletNode(inputCtx, "audio-processor");
      workletNode.current.port.onmessage = (event: MessageEvent) => {
        if (!isRecordingRef.current) return;
        const pcmData = event.data;
        session.current?.sendRealtimeInput({ media: createBlob(pcmData) });
      };

      sourceNode.current = inputCtx.createMediaStreamSource(
        mediaStream.current
      );
      sourceNode.current.connect(inputGain);
      inputGain.connect(workletNode.current);
      workletNode.current.connect(inputCtx.destination);

      setIsRecording(true);
      setStatus("🔴 Recording... Bolna shuru karein!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error starting audio capture:", err);
      setStatus(`Error: ${errorMessage}`);
      stopRecording();
    }
  }, [audioGraph, stopRecording]);

  const initSession = useCallback(async () => {
    const model = "gemini-2.5-flash-preview-native-audio-dialog";
    if (!client.current) return;
    setStatus("Connecting...");
    try {
      const newSession = await client.current.live.connect({
        model: model,
        config: {
          systemInstruction:
            'You are a friendly and helpful AI assistant named Riya. Your voice should be soft, clear, and pleasing. Start the conversation with a warm, welcoming greeting in Hinglish, for example, "Namaste, main Riya hu. Main aapki kya sahayata kar sakti hu?". After the greeting, continue all responses in Hinglish (a mix of Hindi and English).',
          responseModalities: [Modality.AUDIO],
        },
        callbacks: {
          onopen: () => {
            setStatus("Connection opened. Starting capture...");
          },
          onmessage: async (message: LiveServerMessage) => {
            const audio =
              message.serverContent?.modelTurn?.parts &&
              message.serverContent.modelTurn.parts[0]?.inlineData;
            if (audio?.data) {
              const { outputCtx, outputGain } = audioGraph;
              nextStartTime.current = Math.max(
                nextStartTime.current,
                outputCtx.currentTime
              );
              const audioBuffer = await decodeAudioData(
                decode(audio.data as string),
                outputCtx,
                24000,
                1
              );
              const source = outputCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputGain);
              source.addEventListener("ended", () => {
                sources.current.delete(source);
              });
              source.start(nextStartTime.current);
              nextStartTime.current += audioBuffer.duration;
              sources.current.add(source);
            }
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of sources.current.values()) {
                source.stop();
                sources.current.delete(source);
              }
              nextStartTime.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => setError(e.message),
          onclose: (e: CloseEvent) => {
            setStatus("Connection closed: " + e.reason);
            setError(e.reason);
            setIsRecording(false);
          },
        },
      });

      session.current = newSession;
      await startAudioCapture();
    } catch (e) {
      console.error(e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
      setStatus(`Error: ${errorMessage}`);
    }
  }, [audioGraph, startAudioCapture]);

  useEffect(() => {
    client.current = new GoogleGenAI({
      apiKey: import.meta.env.VITE_API_KEY || "", // Ensure API_KEY is always a string
    });
    nextStartTime.current = audioGraph.outputCtx.currentTime;

    return () => {
      session.current?.close();
      audioGraph.inputCtx.close();
      audioGraph.outputCtx.close();
    };
  }, [audioGraph]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    setError("");

    // First, get microphone permission
    setStatus("Requesting microphone access...");
    try {
      mediaStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      setStatus("Microphone access granted. Connecting to AI...");
      await initSession();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Error getting microphone:", err);
      setStatus(`Error: ${errorMessage}`);
      setError(errorMessage);
    }
  }, [initSession]);

  const reset = useCallback(() => {
    if (isRecording) return; // Don't reset while recording
    stopRecording(); // Stop will close and clear the session
    for (const source of sources.current.values()) {
      source.stop();
      sources.current.delete(source);
    }
    nextStartTime.current = 0;
    setStatus("Session reset. Click Start to begin again.");
    setError("");
  }, [isRecording, stopRecording]);

  const styles = `
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
      color: white;
      font-family: sans-serif;
    }

    .controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 10px;
    }

    .controls button {
        outline: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        width: 64px;
        height: 64px;
        cursor: pointer;
        font-size: 24px;
        padding: 0;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s;
    }

    .controls button:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .controls button:disabled {
        display: none;
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <div>
        <div className="controls">
          <button
            id="resetButton"
            onClick={reset}
            disabled={isRecording}
            aria-label="Reset Session"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="40px"
              viewBox="0 -960 960 960"
              width="40px"
              fill="#ffffff"
            >
              <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
            </svg>
          </button>
          <button
            id="startButton"
            onClick={startRecording}
            disabled={isRecording}
            aria-label="Start Recording"
          >
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#c80000"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="50" />
            </svg>
          </button>
          <button
            id="stopButton"
            onClick={stopRecording}
            disabled={!isRecording}
            aria-label="Stop Recording"
          >
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#000000"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="0" y="0" width="100" height="100" rx="15" />
            </svg>
          </button>
        </div>

        <div id="status">
          {" "}
          {status} {error && `Error: ${error}`}{" "}
        </div>
        <GdmLiveAudioVisuals3D
          inputNode={audioGraph.inputGain}
          outputNode={audioGraph.outputGain}
        />
      </div>
    </>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
