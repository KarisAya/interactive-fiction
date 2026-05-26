import { marked } from "marked";
import type { ResponseData } from './openai-api';

const renderer = new marked.Renderer();

export type ExtendResp = [string | null, ResponseData, string];


async function fetchResp(url: string, options: RequestInit): Promise<Response> {
    const api = localStorage.getItem("ifApiUrl") || "/api";
    const response = await fetch(`${api.replace(/\/$/, "")}${url}`, options);
    if (!response.ok) {
        throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }
    return response;
}
async function fetchText(url: string, options: RequestInit): Promise<string> {
    const resp = await fetchResp(url, options);
    return await resp.text();
}

async function fetchJson<T>(url: string, options: RequestInit): Promise<T> {
    const resp = await fetchResp(url, options);
    return await resp.json();
}

async function generateImageByContent(content: string): Promise<string> {
    const data = await fetchJson<{ imageUrl: string }>("/generate-image", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "content": content })
    });
    return data.imageUrl;
}

export async function generateColorsByStory(story: string): Promise<string[]> {
    // 让大模型根据小说风格返回 5 个 hex 颜色数组
    const data = await fetchJson<string[]>("/generate-colors", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "story": story })
    });
    return data;
}

export async function ifSTART(theme: string): Promise<[ExtendResp, string[]]> {
    const res = await fetchJson<ResponseData>("/if-start", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "theme": `主题为\n\n${theme}\n\n请开始创作` })
    });
    const [image, colors, markedContent] = await Promise.all([
        generateImageByContent(res.content).catch(() => null),
        generateColorsByStory(`${theme}\n${res.content}`).catch(() => []),
        marked.parse(res.content, { renderer })
    ]);
    return [[image, res, markedContent], colors.length == 5 ? colors : []];
}

export async function ifKEEP(messages: string[]): Promise<ExtendResp> {
    if (messages.length < 2) { throw new Error("请至少输入两个选项"); }
    const content = `当前剧情\n${messages.slice(0, -1).join("\n")}\n用户的选择\n${messages.at(-1)}`
    const res = await fetchJson<ResponseData>("/if-keep", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "content": content })
    });
    const markedContent = await marked.parse(res.content, { renderer });
    return [null, res, markedContent];
}

export async function ifBE(messages: string[]): Promise<ExtendResp> {
    const content = `当前剧情\n${messages.slice(0, -1).join("\n")}\n用户的选择\n${messages.at(-1)}`
    const res = await fetchText("/if-be", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "content": content })
    });
    const markedContent = await marked.parse(res, { renderer });
    return [null, { title: "", content: res, options: [], correct: -1 }, markedContent];
}

export async function ifHE(messages: string[]): Promise<ExtendResp> {
    const content = `当前剧情\n${messages.slice(0, -1).join("\n")}\n用户的选择\n${messages.at(-1)}`
    const res = await fetchText("/if-he", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ "content": content })
    });
    const markedContent = await marked.parse(res, { renderer });
    return [null, { title: "", content: res, options: [], correct: -1 }, markedContent];
}