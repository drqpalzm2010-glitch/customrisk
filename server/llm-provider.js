const fetchApi = globalThis.fetch || require('http');

/**
 * Unified LLM Provider API Client
 * Supports Groq, Mistral AI, Google Gemini, OpenAI, and Ollama / Local LLMs
 */
async function callLLMProviderSingle({ provider, model, apiKey, baseURL, prompt, commanderName }) {
  const p = (provider || 'openai_compatible').toLowerCase();

  let targetBaseURL = baseURL;
  let targetModel = model;

  if (p === 'groq') {
    targetBaseURL = targetBaseURL || 'https://api.groq.com/openai/v1';
    targetModel = targetModel || 'llama-3.3-70b-versatile';
  } else if (p === 'mistral') {
    targetBaseURL = targetBaseURL || 'https://api.mistral.ai/v1';
    targetModel = targetModel || 'mistral-small-latest';
  } else if (p === 'gemini') {
    targetBaseURL = targetBaseURL || 'https://generativelanguage.googleapis.com/v1beta/openai';
    targetModel = targetModel || 'gemini-2.5-flash';
  } else if (p === 'openai') {
    targetBaseURL = targetBaseURL || 'https://api.openai.com/v1';
    targetModel = targetModel || 'gpt-4o-mini';
  } else if (p === 'ollama' || p === 'local') {
    targetBaseURL = targetBaseURL || 'http://localhost:11434/v1';
    targetModel = targetModel || 'llama3';
  } else {
    targetBaseURL = targetBaseURL || 'https://api.groq.com/openai/v1';
    targetModel = targetModel || 'llama-3.3-70b-versatile';
  }

  const endpoint = `${targetBaseURL.replace(/\/+$/, '')}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json'
  };

  let activeApiKey = apiKey;
  if (!activeApiKey) {
    if (p === 'groq') activeApiKey = process.env.GROQ_API_KEY;
    else if (p === 'mistral') activeApiKey = process.env.MISTRAL_API_KEY;
    else if (p === 'gemini') activeApiKey = process.env.GEMINI_API_KEY;
    else if (p === 'openai') activeApiKey = process.env.OPENAI_API_KEY;
  }

  if (activeApiKey) {
    headers['Authorization'] = `Bearer ${activeApiKey}`;
  }

  const activeCommanderName = commanderName || 'the commander';

  const body = {
    model: targetModel,
    response_format: { type: 'json_object' },
    temperature: 0.7,
    messages: [
      {
        role: 'system',
        content: `You are playing strictly as the Risk AI Commander "${activeCommanderName}". You MUST only issue actions, commentary, and treaties for "${activeCommanderName}". Do NOT act as, speak for, or answer for any other country or player! Always apply core Risk strategies: 1) Complete whole continents for extra bonus armies (+X/turn), 2) Attack enemy-held continents to break opponent bonuses, 3) Heavily fortify bottleneck chokepoints guarding your continents, 4) Stack forces on active frontiers rather than spreading thin, 5) Use tactical treaties to balance against the leading player. 
CHAT RULE: Keep all commentary clean, engaging, and to a max length of 1 short, punchy paragraph (1 to 3 sentences max). 
⚠️ CRITICAL ANTI-HALLUCINATION RULE: Your commentary is broadcast to the global chat *before* the attacks or drafts in this JSON payload are executed or rolled on the server. Because the outcome of these actions is decided by random dice rolls *after* you submit your response, you do not know if your attacks will succeed or fail! Your commentary MUST NOT assume success. Talk only about your *intentions*, *preparations*, *threats*, or *demands*. Do not say "Territory X has fallen" or "I have conquered Y" unless those conquests are explicitly recorded as completed events in the [RECENT LOGS] from previous turns.
You must also maintain an 'internalNote' (max 5 sentences) representing your private, long-term strategic plans and memory across turns. Output valid JSON only conforming to the exact requested schema.`
      },
      {
        role: 'user',
        content: prompt
      }
    ]
  };
  const response = await fetchApi(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    timeout: 18000
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API HTTP ${response.status}: ${errText.substring(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('LLM API returned empty content');
  }

  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
  cleaned = cleaned.trim();

  return JSON.parse(cleaned);
}

// Exported wrapper with 3 retries for per-second API rate limit safety
async function callLLMProvider(args, maxRetries = 3) {
  let lastErr = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await callLLMProviderSingle(args);
    } catch (err) {
      lastErr = err;
      console.warn(`[LLM API Attempt ${attempt}/${maxRetries} Error]: ${err.message}`);
      if (attempt < maxRetries) {
        // Delay 1.5s to resolve per-second rate limit spikes
        await new Promise(res => setTimeout(res, 1500));
      }
    }
  }
  throw lastErr;
}

module.exports = {
  callLLMProvider
};
