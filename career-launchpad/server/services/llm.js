// LLM service - talks to NVIDIA NIM using OpenAI SDK
// NIM uses the same API format as OpenAI so the SDK works directly

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

// NVIDIA NIM Configuration 
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.3-70b-instruct";
const MAX_TOKENS = 1500;

// The OpenAI SDK works directly with NVIDIA NIM because NIM
// exposes the same /v1/chat/completions endpoint format.
const client = new OpenAI({
  apiKey: NVIDIA_API_KEY,
  baseURL: NVIDIA_BASE_URL,
});

// Send a message to NIM and get a response back
export async function askLLM(systemPrompt, userMessage) {
  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      top_p: 0.9,
    });

    // Extract the assistant's response
    const text = response.choices?.[0]?.message?.content || "";

    return {
      success: true,
      data: text,
      usage: {
        input_tokens: response.usage?.prompt_tokens || 0,
        output_tokens: response.usage?.completion_tokens || 0,
        model: response.model || MODEL,
      },
    };
  } catch (error) {
    console.error("NVIDIA NIM API error:", error.message);

    if (error.status === 401 || error.status === 403) {
      return { success: false, error: "Invalid API key. Check your NVIDIA_API_KEY." };
    }
    if (error.status === 429) {
      return { success: false, error: "Rate limited. Please wait a moment and try again." };
    }
    if (error.status === 503 || error.status === 529) {
      return { success: false, error: "NVIDIA NIM API is temporarily overloaded. Please try again." };
    }

    return { success: false, error: `LLM error: ${error.message}` };
  }
}

export default { askLLM };
