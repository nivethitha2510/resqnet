/**
 * VoiceInput Component
 */

import React, { useState } from 'react';
import { sttService } from '../../services/sttService';
import type { STTStatus } from '../../services/sttService';
import type { LanguageCode } from '../../types/domain';
import { Mic, MicOff, AlertCircle, Globe } from 'lucide-react';

interface VoiceInputProps {
  onTranscriptUpdate: (text: string) => void;
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscriptUpdate,
  currentLanguage,
  onLanguageChange,
}) => {
  const [status, setStatus] = useState<STTStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleListening = () => {
    setErrorMessage(null);

    if (sttService.getIsListening()) {
      sttService.stopListening();
      setStatus('idle');
    } else {
      sttService.startListening(currentLanguage, {
        onResult: (transcript) => {
          onTranscriptUpdate(transcript);
        },
        onError: (err) => {
          setErrorMessage(err);
          setStatus('error');
        },
        onStatusChange: (newStatus) => {
          setStatus(newStatus);
        },
      });
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`p-2 rounded-lg ${status === 'listening' ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
            {status === 'listening' ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Voice Input</h4>
            <p className="text-xs text-slate-500">
              {status === 'listening' ? 'Listening... Speak now' : 'Click microphone to record emergency report'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-lg text-xs font-medium">
          <Globe className="w-3.5 h-3.5 text-slate-500 ml-1" />
          <button
            type="button"
            onClick={() => onLanguageChange('en-US')}
            className={`px-2 py-1 rounded transition-colors ${currentLanguage === 'en-US' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            English
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('ta-IN')}
            className={`px-2 py-1 rounded transition-colors ${currentLanguage === 'ta-IN' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            தமிழ்
          </button>
          <button
            type="button"
            onClick={() => onLanguageChange('hi-IN')}
            className={`px-2 py-1 rounded transition-colors ${currentLanguage === 'hi-IN' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      <div className="flex justify-center py-2">
        <button
          type="button"
          onClick={toggleListening}
          className={`flex items-center space-x-2 px-6 py-3 rounded-full font-medium transition-all shadow-md ${
            status === 'listening'
              ? 'bg-red-600 hover:bg-red-700 text-white ring-4 ring-red-200'
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          {status === 'listening' ? (
            <>
              <span className="w-3 h-3 bg-white rounded-full animate-ping mr-1" />
              <span>Stop Recording</span>
            </>
          ) : (
            <>
              <Mic className="w-5 h-5" />
              <span>Start Voice Recording</span>
            </>
          )}
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-start space-x-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
};
