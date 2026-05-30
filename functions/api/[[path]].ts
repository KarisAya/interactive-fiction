
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { SSEStreamingApi, streamSSE } from 'hono/streaming';
import { handle } from 'hono/cloudflare-pages';
import type { Payload } from '../../src/openai-api';
import { streamReader } from '../../src/utils';
import { createPrompt, keepPrompt, bePrompt, hePrompt, themePrompt } from './prompts';

export interface Bindings {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    OPENAI_BASE_URL?: string;
}

async function callApi<T>(env: Bindings, payload: Payload, extract: (arg0: string) => T): Promise<T> {
    const apiKey = env.OPENAI_API_KEY;
    const model = env.OPENAI_MODEL;
    const baseUrl = env.OPENAI_BASE_URL;
    if (!(apiKey && model && baseUrl)) throw new Error('Service is not enabled.');
    payload.model = model;
    const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
    })
    return extract(await resp.json())
}

async function callApiStream(env: Bindings, payload: Payload) {
    const apiKey = env.OPENAI_API_KEY;
    const model = env.OPENAI_MODEL;
    const baseUrl = env.OPENAI_BASE_URL;
    if (!(apiKey && model && baseUrl)) throw new Error('Service is not enabled.');
    payload.model = model;
    payload.stream = true;
    const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
    })
    if (!resp.ok) {
        const errorText = await resp.text();
        throw new Error(`API error (${resp.status}): ${errorText}`);
    }
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('Response body is not readable.');
    return reader
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
app.use('*', cors({
    origin: (origin) => { return allowedOrigins.includes(origin) ? origin : null },
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: ['Content-Length'],
    maxAge: 600,
    credentials: true,
}));

function streamRespFrom(
    reader: ReadableStreamDefaultReader<Uint8Array>,
) {
    return async (stream: SSEStreamingApi) => {
        await streamReader(reader, async (arg0) => {
            const content = JSON.parse(arg0).choices?.[0]?.delta?.content;
            if (content) { await stream.writeSSE({ data: content }); }
        })
    }
}

app.post('/if-start', async (c) => {
    try {
        const content = await c.req.text();
        if (!content) { return c.json({ error: 'Request body cannot be empty.' }, 400); }
        if (content.length > 1000) { return c.json({ error: 'Request body cannot be longer than 1,000 characters.' }, 400); }
        const reader = await callApiStream(c.env, {
            model: "",
            messages: [{ role: "system", content: createPrompt }, { role: "user", content: content }],
            response_format: { type: "json_object" }
        });
        return streamSSE(c, streamRespFrom(reader))
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/if-keep', async (c) => {
    try {
        let content = await c.req.text();
        if (!content) { return c.json({ error: 'Request body cannot be empty.' }, 400); }
        if (content.length > 100000) { return c.json({ error: 'Request body cannot be longer than 100,000 characters.' }, 400); }
        const reader = await callApiStream(c.env, {
            model: "",
            messages: [{ role: "system", content: keepPrompt }, { role: "user", content: content }],
        });
        return streamSSE(c, streamRespFrom(reader))
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});


app.post('/if-be', async (c) => {
    try {
        const content = await c.req.text();
        if (!content) { return c.json({ error: 'Request body cannot be empty.' }, 400); }
        if (content.length > 100000) { return c.json({ error: 'Request body cannot be longer than 100,000 characters.' }, 400); }
        const reader = await callApiStream(c.env, {
            model: "",
            messages: [{ role: "system", content: bePrompt }, { role: "user", content: content }],
        });
        return streamSSE(c, streamRespFrom(reader))
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/if-he', async (c) => {
    try {
        const content = await c.req.text();
        if (!content) { return c.json({ error: 'Request body cannot be empty.' }, 400); }
        if (content.length > 100000) { return c.json({ error: 'Request body cannot be longer than 100,000 characters.' }, 400); }
        const reader = await callApiStream(c.env, {
            model: "",
            messages: [{ role: "system", content: hePrompt }, { role: "user", content: content }],
        });
        return streamSSE(c, streamRespFrom(reader))
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/generate-colors', async (c) => {
    try {
        const content = await c.req.text();
        if (!content) { return c.json({ error: 'Request body cannot be empty.' }, 400); }
        if (content.length > 10000) { return c.json({ error: 'Request body cannot be longer than 10,000 characters.' }, 400); }
        const resp = await callApi<string>(c.env, {
            model: "",
            messages: [{ role: "system", content: themePrompt }, { role: "user", content: content }],
            response_format: { type: "json_object", }
        }, (r: any) => r.choices[0].message.content);
        return c.newResponse(resp, 200, { 'Content-Type': 'application/json' });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export const onRequest = handle(app);