import { marked } from "marked";
import type { ResponseData } from './openai-api';

const renderer = new marked.Renderer();

export type ExtendResp = [string | null, ResponseData, string];



async function fetchJson<T>(url: string, options: RequestInit): Promise<T> {
    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

async function generateImageByContent(content: string): Promise<string> {
    const data = await fetchJson<{ imageUrl: string }>("/api/generate-image", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "content": content })
    });
    return data.imageUrl;
}

async function generateColorsByTitle(title: string): Promise<string[]> {
    // 让大模型根据小说风格返回 5 个 hex 颜色数组
    const data = await fetchJson<{ colors: string[] }>("/api/generate-colors", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "title": title })
    });
    return data.colors;
}

export async function ifSTART(theme: string): Promise<[ExtendResp, string[]]> {
    const res = await fetchJson<ResponseData>("/api/if-start", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "theme": theme })
    });
    const [image, colors, markedContent] = await Promise.all([
        generateImageByContent(res.content).catch(() => null),
        generateColorsByTitle(res.title).catch(() => []),
        marked.parse(res.content, { renderer })
    ]);

    return [[image, res, markedContent], colors];
}

export async function ifKEEP(messages: string[]): Promise<ExtendResp> {
    const res = await fetchJson<ResponseData>("/api/if-keep", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "content": messages.join("\n") })
    });
    const markedContent = await marked.parse(res.content, { renderer });
    return [null, res, markedContent];
}

export async function ifBE(messages: string[]): Promise<ExtendResp> {
    const res = await fetchJson<{ "content": string }>("/api/if-be", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "content": messages.join("\n") })
    });
    const markedContent = await marked.parse(res.content, { renderer });
    return [null, { title: "", content: res.content, options: [], correct: -1 }, markedContent];
}