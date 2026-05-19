import { useState, useRef, useEffect } from 'react';

export function useTTS() {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (Ctx) audioCtxRef.current = new Ctx({ sampleRate: 24000 });
    }
    return () => {
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(console.error);
        audioCtxRef.current = null;
      }
    };
  }, []);

  const stopAudio = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const playAudioFeedback = async (text: string) => {
    // AUDIT-ISSUE: AudioContext Autoplay Risk
    // Audio playback must be tied to a trusted user gesture (button click) 
    // to bypass browser autoplay restrictions. Warning: calling this via async
    // callbacks outside click handlers may fail in some mobile browsers.
    if (isPlayingAudio) {
      stopAudio();
      return;
    }

    if (!text) return;
    setIsGeneratingAudio(true);
    try {
      const res = await fetch('/api/gemini/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          const binaryStr = atob(data.audio);
          const pcm16 = new Int16Array(binaryStr.length / 2);
          for (let i = 0; i < binaryStr.length / 2; i++) {
            const lsb = binaryStr.charCodeAt(i * 2);
            const msb = binaryStr.charCodeAt(i * 2 + 1);
            const val = (msb << 8) | lsb;
            pcm16[i] = val >= 32768 ? val - 65536 : val;
          }
          const float32 = new Float32Array(pcm16.length);
          for (let i = 0; i < pcm16.length; i++) {
            float32[i] = pcm16[i] / 32768.0;
          }

          if (audioCtxRef.current) {
            const audioBuffer = audioCtxRef.current.createBuffer(1, float32.length, 24000);
            audioBuffer.getChannelData(0).set(float32);
            const sourceNode = audioCtxRef.current.createBufferSource();
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(audioCtxRef.current.destination);
            
            sourceNode.onended = () => {
              setIsPlayingAudio(false);
              audioSourceRef.current = null;
            };
            
            audioSourceRef.current = sourceNode;
            sourceNode.start(0);
            setIsPlayingAudio(true);
          }
        }
      } else {
        console.error("Failed to generate audio:", await res.text());
      }
    } catch (e) {
      console.error("Audio generation failed:", e);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  return { playAudioFeedback, stopAudio, isPlayingAudio, isGeneratingAudio };
}
