/**
 * ReportEmergency Page
 * Integrates real Supabase Edge Function AI Analysis (`analyze-emergency`)
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VoiceInput } from '../../components/voice/VoiceInput';
import { ModularMap } from '../../components/map/ModularMap';
import { locationService } from '../../services/locationService';
import { aiService } from '../../services/aiService';
import type { EmergencyType, LanguageCode, LocationCoordinates } from '../../types/domain';
import {
  Flame,
  Waves,
  Stethoscope,
  Car,
  Building2,
  Wind,
  AlertTriangle,
  ShieldAlert,
  MapPin,
  Upload,
  ArrowRight,
  Loader2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

export const ReportEmergency: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [emergencyType, setEmergencyType] = useState<EmergencyType>(
    (searchParams.get('type') as EmergencyType) || 'fire'
  );
  const [rawText, setRawText] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [language, setLanguage] = useState<LanguageCode>('en-US');
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  
  const [location, setLocation] = useState<LocationCoordinates>({
    latitude: 13.0827,
    longitude: 80.2707,
    address: 'Fetching location...',
  });
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    handleFetchGPS();
  }, []);

  const handleFetchGPS = async () => {
    setIsLocating(true);
    setLocationError(null);
    try {
      const coords = await locationService.getCurrentPosition();
      setLocation(coords);
    } catch (err: any) {
      setLocationError(err.message || 'Could not fetch GPS. Please click on map to set pin.');
      setLocation({
        latitude: 13.0827,
        longitude: 80.2707,
        address: 'Anna Salai, Chennai (Default)',
      });
    } finally {
      setIsLocating(false);
    }
  };

  const handleMapPinSelect = (newLoc: LocationCoordinates) => {
    setLocation(newLoc);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const names = Array.from(e.target.files).map((f) => f.name);
      setImageFiles((prev) => [...prev, ...names]);
    }
  };

  const handleProceedToPreview = async () => {
    setIsAnalyzing(true);
    setAiError(null);

    try {
      const analysis = await aiService.analyzeEmergencyReport({
        raw_text: rawText,
        voice_transcript: voiceTranscript,
        emergency_type: emergencyType,
        location,
        language,
      });

      navigate('/citizen/report/preview', {
        state: {
          emergencyType,
          rawText,
          voiceTranscript,
          language,
          imageFiles,
          location,
          aiAnalysis: analysis,
        },
      });
    } catch (err: any) {
      console.error('AI Analysis failed:', err);
      setAiError(err.message || 'AI Analysis backend request failed. Please verify Supabase Edge Function deployment and GEMINI_API_KEY secret.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const emergencyCategories: { type: EmergencyType; label: string; icon: any }[] = [
    { type: 'fire', label: 'Fire', icon: Flame },
    { type: 'flood', label: 'Flood', icon: Waves },
    { type: 'medical', label: 'Medical Emergency', icon: Stethoscope },
    { type: 'road_accident', label: 'Road Accident', icon: Car },
    { type: 'building_collapse', label: 'Building Collapse', icon: Building2 },
    { type: 'cyclone_storm', label: 'Cyclone / Storm', icon: Wind },
    { type: 'landslide', label: 'Landslide', icon: AlertTriangle },
    { type: 'other', label: 'Other Emergency', icon: ShieldAlert },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">Report Emergency</h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Provide emergency details via voice, text, image, and location map.
        </p>
      </div>

      {aiError && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start space-x-3 text-red-800 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Real AI Analysis Backend Error</span>
            <p>{aiError}</p>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <label className="block text-sm font-bold text-slate-900">1. Emergency Type</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {emergencyCategories.map((cat) => {
            const Icon = cat.icon;
            const selected = emergencyType === cat.type;
            return (
              <button
                key={cat.type}
                type="button"
                onClick={() => setEmergencyType(cat.type)}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1.5 transition-all text-xs font-semibold ${
                  selected
                    ? 'bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-200'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <label className="block text-sm font-bold text-slate-900">2. Voice Report (Tamil / English / Hindi)</label>
        <VoiceInput
          onTranscriptUpdate={(text) => setVoiceTranscript(text)}
          currentLanguage={language}
          onLanguageChange={(lang) => setLanguage(lang)}
        />
        {voiceTranscript && (
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs text-slate-800 space-y-1">
            <span className="font-bold text-slate-900">Captured Voice Text:</span>
            <p className="italic">"{voiceTranscript}"</p>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <label className="block text-sm font-bold text-slate-900">3. Text Description (Optional details)</label>
        <textarea
          rows={3}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Describe the situation, landmark, trapped people, or required immediate help..."
          className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 text-slate-900"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <label className="block text-sm font-bold text-slate-900">4. Attach Photos / Media Evidence</label>
        <div className="flex items-center space-x-3">
          <label className="cursor-pointer inline-flex items-center space-x-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl border border-slate-300 transition-colors">
            <Upload className="w-4 h-4 text-slate-600" />
            <span>Select Photos</span>
            <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
          </label>

          {imageFiles.length > 0 && (
            <div className="flex items-center space-x-2 text-xs text-emerald-700 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <span>{imageFiles.length} photo(s) selected</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-bold text-slate-900">5. Emergency Location</label>
          <button
            type="button"
            onClick={handleFetchGPS}
            disabled={isLocating}
            className="inline-flex items-center space-x-1 text-xs font-semibold text-red-600 hover:text-red-700"
          >
            {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
            <span>{isLocating ? 'Locating...' : 'Use My GPS'}</span>
          </button>
        </div>

        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
          <span className="font-bold text-slate-900">Current Pin Address:</span> {location.address}
        </div>

        {locationError && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">{locationError}</p>
        )}

        <ModularMap
          center={location}
          zoom={14}
          selectableLocation={true}
          onLocationSelect={handleMapPinSelect}
          selectedLocationPin={location}
          height="280px"
        />
        <p className="text-xs text-slate-500 italic">Tap on the map to place an exact emergency pin.</p>
      </div>

      <div className="pt-2">
        <button
          type="button"
          onClick={handleProceedToPreview}
          disabled={isAnalyzing}
          className="w-full inline-flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 disabled:bg-slate-400 text-white font-bold text-base py-4 rounded-2xl shadow-lg transition-all"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>CALLING GEMINI AI ANALYZER...</span>
            </>
          ) : (
            <>
              <span>ANALYZE & PREVIEW REPORT</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
