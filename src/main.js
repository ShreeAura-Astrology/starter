import { Client, Users } from 'node-appwrite';
import { getStaticFile } from './utils.js';
import { formatModelOutputToHtml } from './formatModelOutput.js';
import OpenAI from 'openai';
import * as https from 'https';


// This Appwrite function will be executed every time your function is triggered
export default async ({ req, res, log, error }) => {
  // You can use the Appwrite SDK to interact with other services
  // For this example, we're using the Users service
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key'] ?? '');
  const users = new Users(client);

  try {
    const response = await users.list();
    // Log messages and errors to the Appwrite Console
    // These logs won't be seen by your end users
    log(`Total users: ${response.total}`);
  } catch (err) {
    error("Could not list users: " + err.message);
  }

  // The req object contains the request data
  if (req.path === "/ping") {
    // Use res object to respond with text(), json(), or binary()
    // Don't forget to return a response!
    return res.text("Pong");
  }
  if (req.method === 'GET') {
    return res.text(getStaticFile('index.html'), 200, {
      'Content-Type': 'text/html; charset=utf-8',
    });
  }
  if (!req.body.prompt && typeof req.body.prompt !== "string") {
    return res.json({ ok: false, error: "Missing required field `prompt`" }, 400);
  }
  // Avoid logging secrets. Only log presence (boolean) of keys to help debugging.
  try {
    log('OPENAI_API_KEY set: ' + Boolean(process.env['OPENAI_API_KEY']));
    log('OPEN_ROUTER_KEY set: ' + Boolean(process.env['OPEN_ROUTER_KEY']));
  } catch (e) {
    // no-op
    log('Error checking API keys: No enviromnment variables set for API keys OPENAI_API_KEY and OPEN_ROUTER_KEY');
  }

  // Helper: scrub secret-looking fields from objects before returning/logging
  function scrubSecrets(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const seen = new WeakSet();
    function _scrub(o) {
      if (!o || typeof o !== 'object') return o;
      if (seen.has(o)) return undefined;
      seen.add(o);
      if (Array.isArray(o)) return o.map(_scrub);
      const out = {};
      for (const [k, v] of Object.entries(o)) {
        const key = String(k).toLowerCase();
        // mask or remove likely sensitive keys
        if (/api[_-]?key|apikey|secret|token|authorization|access[_-]?token|refresh[_-]?token|client[_-]?secret/i.test(key)) {
          out[k] = typeof v === 'string' ? '[REDACTED]' : null;
          continue;
        }
        // recursively scrub nested objects
        out[k] = (v && typeof v === 'object') ? _scrub(v) : v;
      }
      return out;
    }
    return _scrub(obj);
  }
  const openrouter = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env['OPEN_ROUTER_KEY'], // Your OpenRouter API key
    defaultHeaders: {
      'HTTP-Referer': 'https://shreeauraastrology.wixsite.com/', // Optional. Site URL for rankings on openrouter.ai.
      'X-Title': 'ShreeAura Astrology', // Optional. Site title for rankings on openrouter.ai.
    },
  });

  async function callopenrouter() {
    log('Invoking OpenRouter chat completion with provided prompt:' + req.body.prompt);
    const completion = await openrouter.chat.completions.create({
      model: 'openai/gpt-4o',
      //instructions: 'You are an Astrologer agent named `ShreeAura AI`. You will receive the prediction result from user. You should summarize the content which you receive from user. If you are not sure about file content or codebase structure pertaining to the user’s request, use your tools to read files and get the information.',
      instructions: 'Summarize the content which you receive from user.',
      messages: [
        {
          role: 'user',
          content: req.body.prompt,
        },
      ],
      max_tokens: 4000
    });

    // Return the raw completion object for the caller to handle formatting/response.
    console.log(completion.choices?.[0]?.message ?? completion);
    return completion;
  }
  const openai = new OpenAI(
    {
      //   base_url:"https://api.aimlapi.com/v1",
      base_url: "https://api.aimlapi.com/chat/completions",
      apiKey: process.env['OPENAI_API_KEY']
    }
  );
  // Completion Technique
  try {
    //output = await callopenrouter();
    //return output;
    // Prefer using OpenRouter client wrapper which uses the configured `openrouter` instance.
    log('Invoking OpenRouter chat completion with provided prompt');
    const completion = await callopenrouter();
    const json = completion;
    // Log response for debugging (Appwrite console)
    log("Response from OpenRouter API:", scrubSecrets(json));

    // Try multiple possible shapes for the model output so we don't miss the content
    function extractText(obj) {
      if (!obj) return '';

      // If it's already a string
      if (typeof obj === 'string') return obj;

      // If it's an array, try to extract text from first entries
      if (Array.isArray(obj)) {
        // Map and join any textual parts
        const parts = obj.map(item => extractText(item)).filter(Boolean);
        return parts.join('\n\n');
      }

      // If object contains common text fields
      if (typeof obj.text === 'string') return obj.text;
      if (typeof obj.content === 'string') return obj.content;
      if (typeof obj.body === 'string') return obj.body;

      // Some providers use `content` as an array of parts
      if (Array.isArray(obj.content) && obj.content.length > 0) {
        return extractText(obj.content);
      }

      // Some providers use `parts` or `segments`
      if (Array.isArray(obj.parts) && obj.parts.length > 0) {
        return obj.parts.map(p => extractText(p)).filter(Boolean).join('');
      }

      // OpenAI Responses-style: output -> [{content:[{type:'output_text', text:'...'}]}]
      if (Array.isArray(obj.output) && obj.output.length > 0) {
        return extractText(obj.output.map(o => o.content ?? o.text ?? o));
      }

      // If object has nested choices
      if (Array.isArray(obj.choices) && obj.choices.length > 0) {
        return extractText(obj.choices[0]);
      }

      // Generic fallback: check keys for likely text
      const candidateKeys = ['message', 'data', 'result', 'answer', 'reply'];
      for (const k of candidateKeys) {
        if (obj[k]) {
          const found = extractText(obj[k]);
          if (found) return found;
        }
      }

      return '';
    }

    let content = '';
    try {
      // Common OpenAI-like shapes
      if (json?.choices && json.choices.length > 0) {
        const choice = json.choices[0];
        // json.choices[0].message.content
        // Try many nested places
        content = extractText(choice?.message?.content ?? choice?.message ?? choice?.text ?? choice?.delta ?? choice);
      }

      // Try other top-level likely places
      if (!content) content = extractText(json.output ?? json.data ?? json);
    } catch (e) {
      log('Error extracting content from model response: ' + e?.message);
      content = '';
    }

    // As a last resort, if the top-level `message` exists
    if (!content && json?.message) content = extractText(json.message);

    const html = formatModelOutputToHtml(content);

    // Prepare a response. Include raw API response only when debugging to avoid leaking data.
    const payload = { ok: true, completion: content, html };
    if (req.body?.debug || process.env.NODE_ENV !== 'production') payload.rawApiResponse = json;

    return res.json(payload, 200);
    //const data = await response.json();

    // log("Response data:", await response.json());
    // const completion = response.choices[0].message.content;
    // return res.json({ ok: true, completion }, 200);
    //   const response = await openai.chat.completions.create({
    //   model: "gpt-4o",
    //   instructions: 'Summarize the content which you receive from user. If you are not sure about file content or codebase structure pertaining to the user’s request, use your tools to read files and get the information.',
    //   messages: [{ "role": "user", "content": req.body.prompt }]
    // });
    //log('response.choices[0].message.content :' + response.choices[0].message.content)
    // const response = await openai.chat.completions.create({
    //   model: 'gpt-4.1',
    //  // max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS ?? '512'),
    //   messages: [{ role: 'user', content: req.body.prompt }],
    // });
    //log('response.choices[0].message.content :' + response.choices[0].message.content);
    //log('response.data.choices[0].message.content :' + response.data.choices[0].message.content);
    //   const reponse = await openai.responses.create({
    //   model: 'gpt-4o',
    //   instructions: 'Summarize the content which you receive from user.If you are not sure about file content or codebase structure pertaining to the user’s request, use your tools to read files and gather the relevant information: do NOT guess or make up an answer.',
    //   input: req.body.prompt,
    // });
    //  const completion = response.choices[0].message.content;
    // return res.json({ ok: true, completion }, 200);
  } catch (err) {
    return res.json({ ok: false, error: 'Failed to query model.' + err }, 500);
  }

  return res.json({
    "id": "chatcmpl-BxvCure28S6Q7esfOtGqA8LA3lxd4",
    "object": "chat.completion",
    "choices": [
      {
        "index": 0,
        "finish_reason": "stop",
        "logprobs": null,
        "message": {
          "role": "assistant",
          "content": "This is the dummy response from local code.",
          "refusal": null,
          "annotations": []
        }
      }
    ],
    "created": 1753620956,
    "model": "gpt-4o-2024-08-06",
    "usage": {
      "prompt_tokens": 105,
      "completion_tokens": 2079,
      "total_tokens": 2184,
      "prompt_tokens_details": {
        "cached_tokens": 0,
        "audio_tokens": 0
      },
      "completion_tokens_details": {
        "reasoning_tokens": 0,
        "audio_tokens": 0,
        "accepted_prediction_tokens": 0,
        "rejected_prediction_tokens": 0
      }
    },
    "system_fingerprint": "fp_a288987b44"
  });
};
