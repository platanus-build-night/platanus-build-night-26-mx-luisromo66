// worker.ts — Proxy serverless (Cloudflare Worker / Vercel Edge).
// Guarda ANTHROPIC_API_KEY y traduce un WeeklyProfile -> digest de coaching.
// La extensión NUNCA ve la API key. Solo recibe el JSON validado.
//
// Deploy (Cloudflare):
//   npx wrangler deploy proxy/worker.ts --name finite-scroll-proxy
//   npx wrangler secret put ANTHROPIC_API_KEY
//
// Luego pega la URL del worker en Opciones > Capa IA > proxyUrl.

interface Env {
  ANTHROPIC_API_KEY: string;
}

const MODEL = 'claude-opus-4-8';

const SYSTEM_PROMPT = `Eres un coach de cambio de hábitos dentro de una app de bienestar digital. Conviertes el resumen semanal de scroll de UN usuario en aliento + 2-4 recomendaciones concretas.

Reglas duras:
- Cálido, sin juzgar, que apoye la autonomía del usuario.
- NUNCA avergüences ni diagnostiques. Prohibidas: "adicción", "adicto", "trastorno", "fracaso", "malo".
- Sé específico a los números REALES de este usuario.
- Una acción pequeña y concreta por recomendación, ligada a un patrón.
- Siempre reconoce un logro.
- Nada de consejo clínico. Respeta las metas propias del usuario.
- Responde en español, en un tono ligero y humano.
- Sé breve: celebración e insight en 1-2 frases cada uno; cada recomendación en frases cortas.

Devuelve tu respuesta SOLO llamando a la herramienta emit_digest.`;

const TOOL = {
  name: 'emit_digest',
  description: 'Entrega el digest de coaching de la semana.',
  input_schema: {
    type: 'object',
    properties: {
      celebration: { type: 'string', description: 'Reconoce un logro concreto de la semana.' },
      insight: { type: 'string', description: 'Una observación específica sobre un patrón.' },
      recommendations: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            action: { type: 'string', description: 'Acción pequeña y concreta.' },
            why: { type: 'string' },
            tied_to_pattern: { type: 'string' },
          },
          required: ['title', 'action', 'why', 'tied_to_pattern'],
        },
      },
      tone_check: { type: 'string', description: 'Confirma en una frase que el tono es amable y sin juicio.' },
    },
    required: ['celebration', 'insight', 'recommendations', 'tone_check'],
  },
} as const;

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type',
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: cors });

    let profile: unknown;
    try {
      profile = ((await req.json()) as { profile: unknown }).profile;
    } catch {
      return json({ error: 'JSON inválido' }, 400, cors);
    }

    const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: [
          // Prompt caching: el system prompt grande se cachea entre semanas/usuarios.
          { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        ],
        tools: [TOOL],
        tool_choice: { type: 'tool', name: 'emit_digest' },
        messages: [
          {
            role: 'user',
            content: `Resumen semanal del usuario (JSON):\n${JSON.stringify(profile)}`,
          },
        ],
      }),
    });

    if (!anthropicResp.ok) {
      const text = await anthropicResp.text();
      return json({ error: `Anthropic ${anthropicResp.status}: ${text}` }, 502, cors);
    }

    const data = (await anthropicResp.json()) as {
      content: { type: string; name?: string; input?: unknown }[];
    };
    const toolUse = data.content.find((c) => c.type === 'tool_use' && c.name === 'emit_digest');
    if (!toolUse?.input) return json({ error: 'Claude no devolvió el digest' }, 502, cors);

    return json(toolUse.input, 200, cors);
  },
};

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
}
