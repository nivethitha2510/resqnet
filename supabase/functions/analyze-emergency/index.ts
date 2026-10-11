import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIRequestBody {
  raw_text?: string;
  voice_transcript?: string;
  emergency_type?: string;
  location_text?: string;
  latitude?: number;
  longitude?: number;
}

interface StructuredAIAnalysis {
  emergency_type: 'fire' | 'flood' | 'medical' | 'road_accident' | 'building_collapse' | 'cyclone_storm' | 'landslide' | 'other';
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({
          error: 'GEMINI_API_KEY secret is not configured in Supabase Edge Function Secrets.',
          code: 'GEMINI_KEY_MISSING',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const body: AIRequestBody = await req.json();
    const textInput = [body.raw_text, body.voice_transcript].filter(Boolean).join(' ').trim();
    const locationInput = body.location_text || (body.latitude ? `Lat: ${body.latitude}, Lng: ${body.longitude}` : 'Not specified');

    if (!textInput && !body.emergency_type) {
      return new Response(
        JSON.stringify({ error: 'At least text description, voice transcript, or emergency category is required for analysis.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = `You are ResQNet AI, an intelligent emergency response analyzer.
Analyze the following citizen emergency report and extract structured details.
DO NOT invent exact locations or facts that are not present in the input.

INPUT REPORT:
- Category Selected by User: ${body.emergency_type || 'Unspecified'}
- Text/Voice Description: "${textInput || 'No detailed text provided'}"
- Location Info Provided: "${locationInput}"

Respond STRICTLY with valid JSON object matching this schema without markdown or formatting wrappers:
{
  "emergency_type": "fire" | "flood" | "medical" | "road_accident" | "building_collapse" | "cyclone_storm" | "landslide" | "other",
  "summary": "Concise factual summary of the incident",
  "people_affected": number (integer >= 0),
  "injured_count": number (integer >= 0),
  "trapped_count": number (integer >= 0),
  "vulnerable_people": number (integer >= 0),
  "severity": "critical" | "high" | "medium" | "low",
  "confidence": number (float between 0.0 and 1.0),
  "evidence": ["list of factual evidence strings extracted from input"],
  "recommended_response": "Recommended immediate rescue resources to dispatch"
}`;

    // Target active supported Gemini models according to Google Gemini API
    const modelCandidates = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-1.5-pro', 'gemini-2.5-flash'];
    let geminiRes: Response | null = null;
    let modelErrors: Record<string, string> = {};

    for (const model of modelCandidates) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
      geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (geminiRes.ok) {
        console.log(`Successfully generated content using model: ${model}`);
        break;
      } else {
        const err = await geminiRes.text();
        modelErrors[model] = `[${geminiRes.status}] ${err}`;
        console.warn(`Model ${model} returned status ${geminiRes.status}:`, err);
      }
    }

    if (!geminiRes || !geminiRes.ok) {
      return new Response(
        JSON.stringify({ error: 'Gemini API request failed', details: modelErrors }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return new Response(
        JSON.stringify({ error: 'Gemini returned an empty candidate response.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let parsed: StructuredAIAnalysis;
    try {
      const cleanedJson = candidateText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleanedJson);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Gemini response did not conform to valid JSON format.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validTypes = ['fire', 'flood', 'medical', 'road_accident', 'building_collapse', 'cyclone_storm', 'landslide', 'other'];
    const validSeverities = ['critical', 'high', 'medium', 'low'];

    const validated: StructuredAIAnalysis = {
      emergency_type: validTypes.includes(parsed.emergency_type) ? parsed.emergency_type : 'other',
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : 'Emergency report received',
      people_affected: Math.max(0, Number(parsed.people_affected) || 0),
      injured_count: Math.max(0, Number(parsed.injured_count) || 0),
      trapped_count: Math.max(0, Number(parsed.trapped_count) || 0),
      vulnerable_people: Math.max(0, Number(parsed.vulnerable_people) || 0),
      severity: validSeverities.includes(parsed.severity) ? parsed.severity : 'medium',
      confidence: Math.min(1.0, Math.max(0.0, Number(parsed.confidence) || 0.85)),
      evidence: Array.isArray(parsed.evidence) ? parsed.evidence.filter((e) => typeof e === 'string') : [textInput || 'Citizen emergency input'],
      recommended_response: typeof parsed.recommended_response === 'string' ? parsed.recommended_response : 'Dispatch standard emergency response team',
    };

    // Log AI Audit entry into public.ai_audit_logs via Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false },
      });

      await supabase.from('ai_audit_logs').insert({
        ai_module: 'gemini:analyze-emergency',
        confidence_score: validated.confidence,
        recommendation: {
          extracted_analysis: validated,
          input_received: { emergency_type: body.emergency_type, text_snippet: textInput.slice(0, 100) },
        },
      });
    }

    return new Response(JSON.stringify(validated), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Edge Function Exception:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal error processing AI emergency analysis.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
