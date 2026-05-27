
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { handle } from 'hono/cloudflare-pages';
import type { ResponseData, Payload } from '../../src/openai-api';
import { createPrompt, keepPrompt, bePrompt, hePrompt, themePrompt } from './prompts';

export interface Bindings {
    TEXT_API_KEY?: string;
    TEXT_MODEL?: string;
    TEXT_BASE_URL?: string;
}

async function callApi<T>(env: Bindings, payload: Payload, extract: Function): Promise<T> {
    const apiKey = env.TEXT_API_KEY;
    const model = env.TEXT_MODEL;
    const baseUrl = env.TEXT_BASE_URL;
    if (!(apiKey && model && baseUrl)) throw new Error('Service is not enabled.');
    payload.model = model;
    const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
    }).catch(err => { throw new Error(err); })
    return extract(await resp.json())
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


app.post('/if-start', async (c) => {
    try {
        const { theme } = await c.req.json<{ theme: string }>();
        if (!theme) { return c.json({ error: 'The "theme" field is missing in the request body.' }, 400); }
        const resp = await callApi<ResponseData>(c.env, {
            model: "",
            messages: [{ role: "system", content: createPrompt }, { role: "user", content: theme }],
            response_format: { type: "json_object", }
        }, (r: any) => JSON.parse(r.choices[0].message.content));
        resp.incorrect = -1;
        return c.json(resp);
    } catch (err: any) {
        console.error("API call failed:", err);
        return c.json({ error: err.message }, 500);
    }
});

app.post('/if-keep', async (c) => {
    try {
        let { content } = await c.req.json<{ content: string }>();
        if (!content) { return c.json({ error: 'The "content" field is missing in the request body.' }, 400); }
        const incorrect = Math.floor(Math.random() * 3);
        content += `\n\n请将你输出的第 ${incorrect + 1} 个选项作为错误选项`
        const resp = await callApi<ResponseData>(c.env, {
            model: "",
            messages: [{ role: "system", content: keepPrompt }, { role: "user", content: content }],
            response_format: { type: "json_object", }
        }, (r: any) => JSON.parse(r.choices[0].message.content));
        resp.incorrect = incorrect;
        return c.json(resp);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});


app.post('/if-be', async (c) => {
    try {
        const { content } = await c.req.json<{ content: string }>();
        if (!content) { return c.json({ error: 'The "content" field is missing in the request body.' }, 400); }
        const resp = await callApi<string>(c.env, {
            model: "",
            messages: [{ role: "system", content: bePrompt }, { role: "user", content: content }],
        }, (r: any) => r.choices[0].message.content);
        return c.text(resp);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/if-he', async (c) => {
    try {
        const { content } = await c.req.json<{ content: string }>();
        if (!content) { return c.json({ error: 'The "content" field is missing in the request body.' }, 400); }
        const resp = await callApi<string>(c.env, {
            model: "",
            messages: [{ role: "system", content: hePrompt }, { role: "user", content: content }],
        }, (r: any) => r.choices[0].message.content);
        return c.text(resp);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/generate-colors', async (c) => {
    try {
        const { story } = await c.req.json<{ story: string }>();
        const resp = await callApi<string>(c.env, {
            model: "",
            messages: [{ role: "system", content: themePrompt }, { role: "user", content: story }],
            response_format: { type: "json_object", }
        }, (r: any) => r.choices[0].message.content);
        return c.newResponse(resp, 200, { 'Content-Type': 'application/json' });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export const onRequest = handle(app);