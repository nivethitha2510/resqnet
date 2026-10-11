import type { LanguageCode } from '../types/domain';

export type STTStatus = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

export interface STTCallbacks {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (errorMessage: string) => void;
  onStatusChange?: (status: STTStatus) => void;
}

export interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

class STTService {
  private recognition: any = null;
  private isListening: boolean = false;

  public isSupported(): boolean {
    const win = window as unknown as IWindow;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public startListening(language: LanguageCode, callbacks: STTCallbacks): void {
    if (!this.isSupported()) {
      callbacks.onError('Web Speech API is not supported in this browser. Please use Google Chrome, Edge, or enter text manually.');
      if (callbacks.onStatusChange) callbacks.onStatusChange('unsupported');
      return;
    }

    try {
      const win = window as unknown as IWindow;
      const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
      
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = language;

      this.recognition.onstart = () => {
        this.isListening = true;
        if (callbacks.onStatusChange) callbacks.onStatusChange('listening');
      };

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcriptChunk;
          } else {
            interimTranscript += transcriptChunk;
          }
        }

        const currentText = (finalTranscript + interimTranscript).trim();
        const isFinal = !interimTranscript;
        callbacks.onResult(currentText, isFinal);
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        let message = 'Speech recognition error occurred.';
        if (event.error === 'no-speech') {
          message = 'No speech was detected. Please check your microphone and speak clearly.';
        } else if (event.error === 'audio-capture') {
          message = 'Microphone capture failed. Please verify microphone permissions.';
        } else if (event.error === 'not-allowed') {
          message = 'Microphone permission denied. Please allow microphone access in browser settings.';
        }
        callbacks.onError(message);
        if (callbacks.onStatusChange) callbacks.onStatusChange('error');
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (callbacks.onStatusChange) callbacks.onStatusChange('idle');
      };

      this.recognition.start();
    } catch (err: any) {
      this.isListening = false;
      callbacks.onError(err.message || 'Failed to initialize Speech Recognition.');
      if (callbacks.onStatusChange) callbacks.onStatusChange('error');
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('Error stopping speech recognition:', e);
      }
      this.isListening = false;
    }
  }

  public getIsListening(): boolean {
    return this.isListening;
  }
}

export const sttService = new STTService();
