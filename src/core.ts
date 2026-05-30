import { marked } from "marked";
import type { ResponseData, ResponseStreamChunk } from './openai-api';
import { OneLayerStreamJSONParser, streamReader } from './utils';

const renderer = new marked.Renderer();

export type ExtendResp = [ResponseData & { incorrect: number }, string];
async function fetchResp(url: string, options: RequestInit): Promise<Response> {
    const api = localStorage.getItem("ifApiUrl") || "/api";
    const resp = await fetch(`${api.replace(/\/$/, "")}${url}`, options);
    if (!resp.ok) {
        throw new Error(`API 请求失败: ${resp.status} ${resp.statusText}`);
    }
    return resp;
}

async function fetchJson<T>(url: string, options: RequestInit): Promise<T> {
    const resp = await fetchResp(url, options);
    return await resp.json();
}

export async function generateImageByContent(content: string): Promise<string> {
    const data = await fetchJson<{ prompt_id: string }>("/generate-image", {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: content
    });
    return data.prompt_id;
}
export async function viewImageById(prompt_id: string) {
    try {
        return await fetchJson<{ status: "waiting" | "ok" | "error", message: String, raw: string }>(
            `/view-image?prompt_id=${encodeURIComponent(prompt_id)}`,
            { method: 'GET' },
        );
    } catch (e) {
        console.error(e);
        return;
    }

}

export async function generateColorsByStory(story: string): Promise<string[]> {
    const data = await fetchJson<string[]>("/generate-colors", {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: story
    });
    return data;
}
function complete(raw: string) {
    if (raw === '"') return '""';
    if (raw.endsWith('"')) {
        const backslashes = raw.slice(0, -1).match(/\\*$/);
        if (!backslashes || backslashes[0].length % 2 === 0) { return raw; }
        else { return raw + '"'; }
    } else {
        const backslashes = raw.match(/\\*$/);
        if (!backslashes || backslashes[0].length % 2 === 0) { return raw + '"'; }
        else { return raw + '\\"'; }
    }
}
export type onParseUpdate = (title: string, html: string) => void
async function streamJsonParse(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    onParseUpdate: onParseUpdate,
) {
    let title = "";
    let content = "";
    let options = "";
    let titleString = "";
    let contentHTML = "";
    const parser = new OneLayerStreamJSONParser();
    parser.onChunk = async (key, chunk) => {
        switch (key) {
            case 'title':
                if (chunk) {
                    title += chunk;
                    titleString = JSON.parse(complete(title))
                    onParseUpdate(titleString, contentHTML);
                }
                break;
            case 'content':
                if (chunk) {
                    content += chunk;
                    contentHTML = await marked.parse(JSON.parse(complete(content)), { renderer })
                    onParseUpdate(titleString, contentHTML);
                }
                break;
            case 'options':
                options += chunk;
        }
    }
    await streamReader(reader, parser.write)
    return {
        title: JSON.parse(title),
        content: JSON.parse(content),
        options: JSON.parse(options),
        incorrect: -1
    };
}

export async function ifSTART(
    theme: string,
    onParseUpdate: onParseUpdate,
): Promise<ExtendResp> {
    const resp = await fetchResp("/if-start", {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: theme
    })
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('Response body is not readable.');
    const respEx = await streamJsonParse(reader, onParseUpdate)
    const markedContent = await marked.parse(respEx.content, { renderer });
    return [respEx, markedContent]
}

export async function ifKEEP(
    messages: string[],
    onParseUpdate: onParseUpdate,
): Promise<ExtendResp> {
    if (messages.length < 2) { throw new Error("请至少输入两个选项"); }
    const content = `当前剧情\n${messages.slice(0, -1).join("\n")}\n用户的选择\n${messages.at(-1)}`
    const resp = await fetchResp("/if-keep", {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: content
    })
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('Response body is not readable.');
    const respEx = await streamJsonParse(reader, onParseUpdate)
    const markedContent = await marked.parse(respEx.content, { renderer });
    const incorrect = Math.floor(Math.random() * 3);
    respEx.incorrect = incorrect;
    if (!Array.isArray(respEx.options)) { respEx.options = []; }
    const badopt = respEx.options.pop();
    if (!badopt) { respEx.incorrect = -1; }
    else { respEx.options.splice(incorrect, 0, badopt); }
    return [respEx, markedContent]
}

export async function ifBE(
    messages: string[],
    onParseUpdate: onParseUpdate,
): Promise<ExtendResp> {
    const content = `当前剧情\n${messages.slice(0, -1).join("\n")}\n用户的选择\n${messages.at(-1)}`
    const resp = await fetchResp("/if-be", {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: content
    });
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('Response body is not readable.');
    const respEx = {
        title: "BAD END",
        content: "",
        options: [],
        incorrect: -1
    }
    await streamReader(reader, async (chunk) => {
        respEx.content += chunk
        const markedContent = await marked.parse(respEx.content, { renderer });
        onParseUpdate(respEx.title, markedContent)
    })
    const markedContent = await marked.parse(respEx.content, { renderer });
    return [respEx, markedContent]
}

export async function ifHE(
    messages: string[],
    onParseUpdate: onParseUpdate,
): Promise<ExtendResp> {
    const content = `当前剧情\n${messages.slice(0, -1).join("\n")}\n用户的选择\n${messages.at(-1)}`
    const resp = await fetchResp("/if-he", {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: content
    });
    const reader = resp.body?.getReader();
    if (!reader) throw new Error('Response body is not readable.');
    const respEx = {
        title: "HAPPY END",
        content: "",
        options: [],
        incorrect: -1
    }
    await streamReader(reader, async (chunk) => {
        respEx.content += chunk
        const markedContent = await marked.parse(respEx.content, { renderer });
        onParseUpdate(respEx.title, markedContent)
    })
    const markedContent = await marked.parse(respEx.content, { renderer });
    return [respEx, markedContent]
}