/**
 * AI Service Architectural Boundary
 * 
 * IMPORTANT ARCHITECTURE RULE:
 * Gemini AI operations run exclusively through the secure Supabase Edge Function (`analyze-emergency`).
 * No VITE_GEMINI_API_KEY is embedded in frontend code.
 * 
 * Invokes Supabase Edge Function `analyze-emergency` using the public Supabase client.
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { EmergencyType, PriorityLevel, LanguageCode, LocationCoordinates } from '../types/domain';

export interface AIAnalysisRequest {
  raw_text?: string;
  voice_transcript?: string;
  emergency_type?: EmergencyType;
  image_urls?: string[];
  location?: LocationCoordinates;
  language?: LanguageCode;
}

export interface AIAnalysisResponse {
  summary: string;
  emergency_type: EmergencyType;
  calculated_priority: PriorityLevel;
  affected_people_count: number;
  trapped_people_count: number;
  injured_people_count: number;
  vulnerable_people_count: number;
  confidence_score: number;
  evidence_snippets: string[];
  suggested_resources: string[];
  priority_reasons: string[];
}

export interface BackendEdgeAIResponse {
  emergency_type: EmergencyType;
  summary: string;
  people_affected: number;
  injured_count: number;
  trapped_count: number;
  vulnerable_people: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  evidence: string[];
  recommended_response: string;
}

class AIService {
  /**
   * Invokes the real Supabase Edge Function `analyze-emergency` to analyze citizen report input with Gemini.
   * NEVER uses fake/mock fallback if backend call fails.
   */
  public async analyzeEmergencyReport(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase project configuration missing. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
    }

    const payload = {
      raw_text: request.raw_text,
      voice_transcript: request.voice_transcript,
      emergency_type: request.emergency_type,
      location_text: request.location?.address,
      latitude: request.location?.latitude,
      longitude: request.location?.longitude,
    };

    const { data, error } = await supabase.functions.invoke<BackendEdgeAIResponse>('analyze-emergency', {
      body: payload,
    });

    if (error) {
      console.error('Edge Function invoke error:', error);
      throw new Error(`AI Analysis Backend Error: ${error.message || 'Failed to communicate with Supabase Edge Function.'}`);
    }

    if (!data) {
      throw new Error('AI Analysis Backend returned an empty response.');
    }

    // Map backend Deno response to domain AIAnalysisResponse structure
    const severityMap: Record<string, PriorityLevel> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    };

    const calculatedPriority: PriorityLevel = severityMap[data.severity] || 'medium';

    return {
      summary: data.summary || 'Emergency reported',
      emergency_type: data.emergency_type || request.emergency_type || 'other',
      calculated_priority: calculatedPriority,
      affected_people_count: data.people_affected || 0,
      trapped_people_count: data.trapped_count || 0,
      injured_people_count: data.injured_count || 0,
      vulnerable_people_count: data.vulnerable_people || 0,
      confidence_score: data.confidence || 0.85,
      evidence_snippets: data.evidence || [],
      suggested_resources: [data.recommended_response || 'Standard Rescue Unit'],
      priority_reasons: [`AI Severity Assessment: ${data.severity.toUpperCase()}`],
    };
  }
}

export const aiService = new AIService();
