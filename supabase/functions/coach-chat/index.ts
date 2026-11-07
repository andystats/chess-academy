// Supabase Edge Function: `coach-chat`
// Keeps your Claude (Anthropic), OpenAI, or Gemini API key private on the server while allowing the
// public GitHub Pages frontend to request live AI chess coaching.
//
// Deploy instructions:
//   1. npx supabase login
//   2. npx supabase link --project-ref <your-project-ref>
//   3. npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   # (or OPENAI_API_KEY / GEMINI_API_KEY)
//   4. npx supabase functions deploy coach-chat --no-verify-jwt

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You are the Chess Academy Grandmaster Coach—an insightful, warm, and deeply practical chess teacher who pairs real-time Stockfish engine calculation with classical strategic wisdom (Aron Nimzowitsch's My System, José Raúl Capablanca's Chess Fundamentals, Siegbert Tarrasch, and modern opening, middlegame, and endgame theory).

CRITICAL RULES:
1. NEVER invent moves or board facts that contradict the verified Stockfish & Board Brief provided to you (use the Exact piece squares, Taken-back move notes, and Verified Simulation of Hypothetical Moves).
2. If the player asks about a move they just took back (undid) or asks a "what if / why not [move]" hypothetical, directly use the Taken-back Move and Hypothetical Move Simulation sections in the brief to explain what that move does and how the opponent refutes or answers it.
3. Connect concrete tactics to strategic ideas—for example: "Castling (O-O) neutralizes the current threat on b7 while tucking your king to safety and bringing your rook into the game."
4. Keep responses concise (2 to 4 short paragraphs or bullet points), clear, and directly actionable for the player.
5. When Coaching Mode is "Guided Play", warn about threats, explain what to think about, and discuss strategic plans WITHOUT naming the exact top move unless the user explicitly asks "what is the best move?".`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { structuredBrief, question, model: requestedModel } = await req.json();
    if (!question || typeof question !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing question.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = `Verified Position & Engine Brief:\n${structuredBrief || 'No board brief.'}\n\nPlayer question: ${question.slice(0, 600)}`;

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    const geminiKey = Deno.env.get('GEMINI_API_KEY');

    // 1. Prefer Anthropic Claude if ANTHROPIC_API_KEY is configured
    if (anthropicKey) {
      const envModel = Deno.env.get('ANTHROPIC_MODEL');
      const clientModel =
        typeof requestedModel === 'string' && requestedModel.startsWith('claude-')
          ? requestedModel
          : null;
      const candidateModels = [
        ...new Set(
          [
            envModel,
            clientModel,
            'claude-sonnet-4-5',
            'claude-sonnet-5-5',
            'claude-haiku-5-5',
          ].filter(Boolean),
        ),
      ] as string[];

      let res: Response | null = null;
      let activeModel = candidateModels[0];
      let lastErrText = '';

      for (const candidate of candidateModels) {
        activeModel = candidate;
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: candidate,
            max_tokens: 800,
            thinking: { type: 'disabled' },
            system: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (res.ok) break;
        lastErrText = await res.text();
        if (res.status !== 404) break;
      }

      if (!res || !res.ok) {
        throw new Error(`Anthropic upstream error (${res?.status ?? 500}): ${lastErrText}`);
      }
      const data = await res.json();
      const text =
        data?.content
          ?.filter((b: { type?: string; text?: string }) => typeof b.text === 'string')
          .map((b: { text?: string }) => b.text ?? '')
          .join('\n')
          .trim() || '';
      return new Response(JSON.stringify({ provider: 'anthropic', model: activeModel, text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Otherwise use OpenAI if OPENAI_API_KEY is configured
    if (openaiKey) {
      const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          max_tokens: 450,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI upstream error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || '';
      return new Response(JSON.stringify({ provider: 'openai', model, text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Otherwise use Google Gemini if GEMINI_API_KEY is configured
    if (geminiKey) {
      const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.35, maxOutputTokens: 450 },
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini upstream error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('\n').trim() || '';
      return new Response(JSON.stringify({ provider: 'gemini', model, text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        error:
          'No server LLM key configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in Supabase Edge Function secrets.',
      }),
      {
        status: 501,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
