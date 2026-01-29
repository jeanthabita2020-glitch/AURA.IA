import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';
import Visualizer from './Visualizer';
import Avatar from './Avatar';
import { VideoCameraIcon, ComputerDesktopIcon, MicrophoneIcon, StopIcon, PlayIcon, XMarkIcon, SpeakerXMarkIcon, ShieldCheckIcon, CubeTransparentIcon } from '@heroicons/react/24/solid';

const LiveInterface: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0); // Input volume
  const [outputVolume, setOutputVolume] = useState(0); // AI speaking volume
  const [videoSource, setVideoSource] = useState<'camera' | 'screen' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSleepMode, setIsSleepMode] = useState(false);
  const [pendingAction, setPendingAction] = useState<'camera' | 'screen' | null>(null);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);

  // Refs for audio processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<Promise<any> | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  
  // Ref for sleep mode to access inside callbacks without stale closures
  const isSleepModeRef = useRef(false);
  // Ref for video source to check status inside callbacks
  const videoSourceRef = useRef<'camera' | 'screen' | null>(null);

  // Refs for video processing
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameIntervalRef = useRef<number | null>(null);

  // Sound Effect for Activation
  const playActivationSound = () => {
      if (!audioContextRef.current) return;
      try {
          const ctx = audioContextRef.current;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          
          osc.connect(gain);
          gain.connect(ctx.destination);
          
          // Sci-fi "Ping" sound
          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
          
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          
          osc.start();
          osc.stop(ctx.currentTime + 0.3);
      } catch (e) {
          console.error("Audio FX Error", e);
      }
  };

  // Helper to toggle sleep mode via voice
  const setSleepState = (sleep: boolean) => {
      // Avoid redundant updates
      if (isSleepModeRef.current === sleep) return;

      isSleepModeRef.current = sleep;
      setIsSleepMode(sleep);
      
      if (sleep) {
          console.log("Entering Sleep Mode");
          // Immediately stop current audio if going to sleep
          sourcesRef.current.forEach(s => s.stop());
          sourcesRef.current.clear();
          nextStartTimeRef.current = 0;
          setIsAiSpeaking(false);
      } else {
          console.log("Waking Up");
          playActivationSound();
      }
  };

  // Cleanup function for video specifically
  const stopVideoStream = useCallback(() => {
    if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (videoRef.current) {
        videoRef.current.srcObject = null;
    }
    setVideoSource(null);
    videoSourceRef.current = null;
  }, []);

  // General cleanup
  const cleanup = useCallback(() => {
    stopVideoStream();
    if (sessionRef.current) {
        sessionRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
    }
    sourcesRef.current.clear();
    setIsConnected(false);
    setVolumeLevel(0);
    setOutputVolume(0);
    setSleepState(false);
    setPendingAction(null);
    setIsAiSpeaking(false);
  }, [stopVideoStream]);

  const startFrameTransmission = (currentSessionPromise?: Promise<any>) => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      const sessionToUse = currentSessionPromise || sessionRef.current;
      if (!sessionToUse) return;

      // 1 FPS transmission
      frameIntervalRef.current = window.setInterval(async () => {
          if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;
          
          if (videoRef.current.videoWidth === 0) return;

          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          ctx.drawImage(videoRef.current, 0, 0);
          
          // Using toDataURL is synchronous and easier for simple frames
          const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
          
          sessionToUse.then((session: any) => {
              try {
                  // Only send video if we are not sleeping
                  session.sendRealtimeInput({
                      media: { data: base64, mimeType: 'image/jpeg' }
                  });
              } catch (e) {
                  console.error("Transmission error:", e);
              }
          }).catch((err: any) => console.error("Session error:", err));
      }, 1000);
  };

  // Video Toggle Logic
  const toggleVideo = async (type: 'camera' | 'screen') => {
      // 1. If trying to turn off the current source
      if (videoSourceRef.current === type) {
          stopVideoStream();
          return;
      }

      // 2. Switching or Turning On
      try {
          // CRITICAL: Request stream immediately to satisfy user gesture requirement
          let stream: MediaStream;
          if (type === 'screen') {
              stream = await navigator.mediaDevices.getDisplayMedia({ 
                  video: { width: { ideal: 1280 }, height: { ideal: 720 } },
                  audio: false
              });
          } else {
              stream = await navigator.mediaDevices.getUserMedia({ 
                  video: { width: 640, height: 480 } 
              });
          }

          // Stop previous stream if exists
          if (streamRef.current) {
              streamRef.current.getTracks().forEach(t => t.stop());
          }

          // Handle stream ending (User clicks "Stop Sharing" on browser UI)
          stream.getVideoTracks()[0].onended = () => {
              stopVideoStream();
          };

          // Update State & Ref
          streamRef.current = stream;
          setVideoSource(type);
          videoSourceRef.current = type;

          // Attach to Video Element
          if (videoRef.current) {
              videoRef.current.srcObject = stream;
              await videoRef.current.play();
          }

          // 3. Connect to AI if not connected, or just start transmitting
          if (!isConnected && !sessionRef.current) {
              await connectToLive();
          } else {
              startFrameTransmission();
          }

      } catch (e: any) {
          console.error("Video Toggle Error", e);
          if (e.name === 'NotAllowedError') {
             setError("Permissão negada (Navegador requer interação manual).");
          } else if (e.name === 'SecurityError' || e.message?.includes('permissions policy')) {
             setError("Bloqueado pela política do navegador.");
          } else {
             setError("Erro ao acessar vídeo: " + (e.message || "Desconhecido"));
          }
          stopVideoStream();
      }
  };

  const connectToLive = async () => {
    setError(null);
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key faltante.");

      const ai = new GoogleGenAI({ apiKey });

      // Audio Outputs
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      // Create output analyser to animate avatar mouth
      const outputAnalyser = audioContextRef.current.createAnalyser();
      outputAnalyser.fftSize = 256;
      outputAnalyserRef.current = outputAnalyser;
      outputAnalyser.connect(audioContextRef.current.destination);

      // Audio Inputs
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const inputSource = inputContextRef.current.createMediaStreamSource(micStream);
      const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
      
      // Setup Visualizer Data for Input
      const inputAnalyzer = inputContextRef.current.createAnalyser();
      inputAnalyzer.fftSize = 256;
      inputSource.connect(inputAnalyzer);
      const inputDataArray = new Uint8Array(inputAnalyzer.frequencyBinCount);
      const outputDataArray = new Uint8Array(outputAnalyser.frequencyBinCount);
      
      const updateVolume = () => {
          if (!sessionRef.current) return;
          
          // Input Volume
          inputAnalyzer.getByteFrequencyData(inputDataArray);
          let inputSum = 0;
          for(let i=0; i<inputDataArray.length; i++) inputSum += inputDataArray[i];
          const inputAvg = inputSum / inputDataArray.length;
          setVolumeLevel(inputAvg / 255); 

          // Output Volume (AI Speaking)
          if (outputAnalyserRef.current) {
            outputAnalyserRef.current.getByteFrequencyData(outputDataArray);
            let outputSum = 0;
            for(let i=0; i<outputDataArray.length; i++) outputSum += outputDataArray[i];
            const outputAvg = outputSum / outputDataArray.length;
            setOutputVolume(outputAvg / 255);
            
            // Heuristic for "Is Speaking"
            setIsAiSpeaking(outputAvg > 10);
          }

          requestAnimationFrame(updateVolume);
      };

      // Connect session
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            if (!inputContextRef.current) {
                console.warn("Session opened after cleanup. Ignoring.");
                return;
            }

            console.log("Aura Connected");
            setIsConnected(true);
            updateVolume();

            // Setup Audio Processing for sending
            processor.onaudioprocess = (e) => {
               if (isMuted) return;
               const inputData = e.inputBuffer.getChannelData(0);
               const pcmBlob = createPcmBlob(inputData);
               sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            inputSource.connect(processor);
            processor.connect(inputContextRef.current.destination);
            
            // Start sending frames if video is already active
            if (streamRef.current) {
                startFrameTransmission(sessionPromise);
            }
          },
          onmessage: async (msg: LiveServerMessage) => {
            // 1. Check for Voice Commands (Immediate Reaction)
            const userTranscript = msg.serverContent?.inputTranscription?.text;
            if (userTranscript) {
                const command = userTranscript.toLowerCase();
                
                // WAKE UP COMMAND (Priority High)
                if (isSleepModeRef.current) {
                    if (command.includes('aura') || command.includes('acordar') || command.includes('ativar') || command.includes('oi')) {
                        setSleepState(false);
                    }
                } 
                // SLEEP COMMAND
                else {
                    if (command.includes('silenciar') || command.includes('modo de espera') || command.includes('dormir')) {
                        setSleepState(true);
                    }
                    
                    // Video Commands (Only if awake)
                    else if (command.includes('abrir câmera') || command.includes('ligar câmera')) {
                        if (videoSourceRef.current !== 'camera') setPendingAction('camera');
                    }
                    else if (command.includes('compartilhar tela') || command.includes('mostrar tela')) {
                        if (videoSourceRef.current !== 'screen') setPendingAction('screen');
                    }
                    else if (command.includes('fechar vídeo') || command.includes('parar vídeo') || command.includes('parar tela')) {
                        if (videoSourceRef.current) stopVideoStream();
                    }
                }
            }

            // 2. Process Audio Output
            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current && !isSleepModeRef.current) {
                const ctx = audioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                
                const buffer = await decodeAudioData(
                    base64ToUint8Array(audioData),
                    ctx
                );
                
                const source = ctx.createBufferSource();
                source.buffer = buffer;
                // Connect to Analyser THEN to Destination
                if (outputAnalyserRef.current) {
                    source.connect(outputAnalyserRef.current);
                } else {
                    source.connect(ctx.destination);
                }
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buffer.duration;
                
                sourcesRef.current.add(source);
                source.onended = () => sourcesRef.current.delete(source);
            }

            if (msg.serverContent?.interrupted) {
                sourcesRef.current.forEach(s => s.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
            }
          },
          onclose: () => {
            console.log("Aura Disconnected");
            setIsConnected(false);
            cleanup();
          },
          onerror: (e) => {
            console.error(e);
            setError("Erro de conexão com Aura.");
            cleanup();
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            inputAudioTranscription: {}, 
            systemInstruction: "Você é a AURA. Uma IA avançada. COMPORTAMENTO DE VOZ: Se o usuário disser 'Silenciar', entre em modo de espera e pare de falar. Se o usuário disser 'Aura' ou 'Acordar', responda imediatamente com uma saudação curta como 'Sim?' ou 'Estou aqui'. Mantenha respostas concisas.",
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            }
        }
      });
      
      sessionRef.current = sessionPromise;

    } catch (err: any) {
        setError(err.message || "Falha ao iniciar sistemas.");
        cleanup();
    }
  };

  const handleMainToggle = () => {
      if (isConnected) {
          cleanup();
      } else {
          connectToLive();
      }
  };

  return (
    <div className="flex flex-col h-full w-full relative overflow-hidden bg-black font-sans">
        
        {/* Dynamic Background */}
        <div className="absolute inset-0 bg-aura-900 opacity-80 z-0"></div>
        <div className="absolute inset-0 bg-grid opacity-20 z-0 animate-pulse"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black z-0 pointer-events-none"></div>

        {/* Main Display Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative p-4 z-10">
            
            {/* Background Visualizer (Subtle) */}
            <div className={`absolute inset-0 flex items-center justify-center opacity-30 transition-all duration-500 ${videoSource ? 'scale-125 opacity-10' : 'scale-100'}`}>
                <Visualizer isActive={isConnected && !isSleepMode} volume={Math.max(volumeLevel, outputVolume)} />
            </div>

            {/* AVATAR LAYER */}
            {/* If video is active, move avatar to bottom-right corner. If not, center it. */}
            <div className={`transition-all duration-700 ease-in-out absolute flex flex-col items-center justify-center z-20 
                ${videoSource 
                    ? 'bottom-6 right-6 w-32 h-32 scale-75 origin-bottom-right' 
                    : 'inset-0 w-full h-full scale-100 origin-center'
                }
            `}>
                <Avatar 
                    isActive={isConnected} 
                    isSleeping={isSleepMode} 
                    volume={outputVolume} // Avatar reacts to AI speaking volume
                    isSpeaking={isAiSpeaking}
                />
                
                {/* Connection Status Text (Only when centered) */}
                {!videoSource && (
                    <div className={`mt-8 font-mono text-sm tracking-[0.3em] transition-opacity duration-300 ${isConnected ? 'text-cyan-400 opacity-100' : 'text-slate-600 opacity-50'}`}>
                        {isConnected ? (isSleepMode ? 'STANDBY MODE' : 'AURA ONLINE') : 'SYSTEM OFFLINE'}
                    </div>
                )}
            </div>

            {/* VIDEO FEED LAYER (Picture in Center when active) */}
            <div className={`relative z-10 transition-all duration-500 flex flex-col items-center w-full max-w-4xl 
                ${videoSource 
                    ? 'opacity-100 scale-100 translate-y-0' 
                    : 'opacity-0 scale-90 translate-y-10 pointer-events-none h-0'
                }
            `}>
                <div className="relative group w-full">
                    {/* Frame Decorations */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
                    
                    <video 
                        ref={videoRef} 
                        muted 
                        playsInline 
                        className={`relative w-full rounded-lg border border-cyan-500/30 bg-black/90 shadow-2xl ${isSleepMode ? 'grayscale opacity-50' : ''}`}
                    />
                    
                    {/* Close Button on Video */}
                     <button 
                        onClick={stopVideoStream}
                        className="absolute top-2 right-2 bg-black/50 hover:bg-red-600/80 text-white p-2 rounded-lg backdrop-blur border border-white/10 transition-all"
                    >
                        <XMarkIcon className="w-4 h-4" />
                    </button>
                    <canvas ref={canvasRef} className="hidden" />
                </div>
                
                {/* HUD Label */}
                <div className="flex items-center gap-2 mt-2 px-4 py-1 bg-black/60 border border-cyan-500/20 rounded-full text-xs font-mono text-cyan-400">
                   <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                   LIVE FEED: {videoSource === 'camera' ? 'OPTICAL SENSOR' : 'SCREEN LINK'}
                </div>
            </div>

            {/* ERROR ALERTS */}
            {error && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-red-950/90 border border-red-500 text-red-200 px-6 py-4 rounded-xl font-mono text-sm z-50 shadow-[0_0_30px_rgba(239,68,68,0.3)] flex items-center gap-3 max-w-md backdrop-blur-md">
                    <SpeakerXMarkIcon className="w-6 h-6 text-red-500" />
                    <div>
                        <div className="font-bold text-red-400 text-xs tracking-wider mb-1">SYSTEM ALERT</div>
                        {error}
                    </div>
                </div>
            )}
        </div>

        {/* CONTROLS HUD */}
        <div className="h-24 bg-black/40 border-t border-cyan-900/30 backdrop-blur-md flex items-center justify-center gap-8 z-30">
            
            {/* Screen Share */}
            <button 
                onClick={() => toggleVideo('screen')}
                title="Compartilhar Tela"
                className={`p-3 rounded-xl border-2 transition-all duration-300 relative group ${videoSource === 'screen'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
                    : 'bg-transparent border-slate-700 text-slate-500 hover:border-cyan-700 hover:text-cyan-500'}`}
            >
                <ComputerDesktopIcon className="w-6 h-6" />
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-cyan-400 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-cyan-900">TELA</span>
            </button>

            {/* MAIN ACTIVATE BUTTON (Big Center) */}
            <button 
                onClick={handleMainToggle}
                className={`w-16 h-16 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-2xl relative group ${isConnected 
                    ? 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.4)]' 
                    : 'bg-cyan-500/10 border-cyan-400 text-cyan-400 hover:bg-cyan-500/20 hover:scale-105 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]'}`}
            >
                <div className={`absolute inset-0 rounded-full border border-current opacity-30 ${isConnected ? 'animate-ping' : ''}`}></div>
                {isConnected ? <StopIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8 ml-1" />}
            </button>

             {/* Camera Toggle */}
             <button 
                onClick={() => toggleVideo('camera')}
                title="Ativar Câmera"
                className={`p-3 rounded-xl border-2 transition-all duration-300 relative group ${videoSource === 'camera'
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(34,211,238,0.3)]' 
                    : 'bg-transparent border-slate-700 text-slate-500 hover:border-cyan-700 hover:text-cyan-500'}`}
            >
                <VideoCameraIcon className="w-6 h-6" />
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-cyan-400 text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border border-cyan-900">CAM</span>
            </button>

             {/* Mute Toggle (Small) */}
             <button 
                onClick={() => setIsMuted(!isMuted)}
                disabled={!isConnected}
                className={`absolute right-6 p-2 rounded-full border transition-all ${isMuted 
                    ? 'bg-red-900/50 border-red-700 text-red-400' 
                    : 'bg-transparent border-slate-800 text-slate-600 hover:text-cyan-400'} disabled:opacity-0`}
            >
                <MicrophoneIcon className="w-4 h-4" />
            </button>

        </div>

        {/* Pending Action Modal */}
        {pendingAction && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-300">
                    <div className="bg-slate-900 border border-cyan-500/50 p-8 rounded-2xl flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(6,182,212,0.3)] max-w-sm mx-4 relative overflow-hidden">
                        {/* Decorative scanning line */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent animate-pulse"></div>

                        <div className="w-16 h-16 rounded-full bg-cyan-950 flex items-center justify-center border border-cyan-400/30">
                            <CubeTransparentIcon className="w-8 h-8 text-cyan-400 animate-spin-slow" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-cyan-100 font-bold text-xl tracking-widest font-mono mb-2">ACESSO REQUERIDO</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                A Cronos precisa de sua permissão manual para ativar o módulo {pendingAction === 'camera' ? 'ÓPTICO' : 'DE TELA'}.
                            </p>
                        </div>
                        <div className="flex gap-4 w-full">
                            <button 
                                onClick={() => { toggleVideo(pendingAction); setPendingAction(null); }}
                                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-lg font-bold text-sm tracking-wider transition-all hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                            >
                                AUTORIZAR
                            </button>
                            <button 
                                onClick={() => setPendingAction(null)}
                                className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 py-3 rounded-lg font-bold text-sm tracking-wider border border-slate-700 transition-all"
                            >
                                CANCELAR
                            </button>
                        </div>
                    </div>
                </div>
            )}
    </div>
  );
};

export default LiveInterface;