
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

export const encode = (bytes: Uint8Array) => {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

export const decode = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const initGeminiLive = async (
  onAudio: (buffer: AudioBuffer) => void,
  onInterrupted: () => void,
  systemInstruction: string = 'You are a helpful AI assistant in a real-time call.'
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const session = await ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
      },
      systemInstruction,
    },
    callbacks: {
      onopen: () => console.log('Gemini Live Connected'),
      onmessage: async (message: LiveServerMessage) => {
        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
        if (base64Audio) {
          // Decoding happens in the component side where AudioContext is managed
          // This is handled via onAudio callback if we pass the raw string or pre-decoded buffer
        }
        if (message.serverContent?.interrupted) {
          onInterrupted();
        }
      },
      onerror: (e) => console.error('Gemini Error:', e),
      onclose: () => console.log('Gemini Live Closed'),
    }
  });

  return session;
};
