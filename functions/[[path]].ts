
import { Hono, Context } from 'hono';
import { handle } from 'hono/cloudflare-pages';
import type { ResponseData, Payload } from '../src/openai-api';

export interface Bindings {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    OPENAI_BASE_URL?: string;
}

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

async function callApi<T>(c: Context, payload: Payload, extract: Function): Promise<T> {
    const apiKey = c.env.OPENAI_API_KEY;
    const model = c.env.OPENAI_MODEL;
    const baseUrl = c.env.OPENAI_API_BASE_URL;
    if (!(apiKey && model && baseUrl)) throw new Error('Service is not enabled.');
    payload.model = model;
    const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(payload),
    }).catch(err => { throw new Error(err); })
    return extract(await resp.json())
}

app.post('/if-start', async (c) => {
    try {
        const { theme } = await c.req.json<{ theme: string }>();
        if (!theme) { return c.json({ error: 'Theme is required' }, 400); }
        const mockResponse: ResponseData = {
            title: `神秘的 ${theme} 冒险`,
            content: `### 故事的开始\n\n你来到了一个充满 **${theme}** 气息的神秘世界。四周迷雾环绕，前方有两条路...`,
            options: [
                "走向左边闪烁着微弱光芒的小路",
                "走向右边传出低沉咆哮的黑森林"
            ],
            correct: 1
        };
        return c.json(mockResponse);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

app.post('/if-keep', async (c) => {
    try {
        const { content } = await c.req.json<{ content: string }>();
        const mockResponse: ResponseData = {
            title: "深入险境",
            content: `### 危机四伏\n\n你做出了选择${content}。继续向前走后，你发现这里的环境变得更加诡异。\n\n*墙壁上刻着奇怪的符号。*`,
            options: [
                "尝试解读符号",
                "无视符号，全速奔跑"
            ],
            correct: 0
        };

        return c.json(mockResponse);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});


app.post('/if-be', async (c) => {
    try {
        const { content } = await c.req.json<{ content: string }>();
        // 结局通常只需要返回内容文本
        const mockResponse = {
            content: `## BAD END ❌\n\n很遗憾，你的冒险在此戛然而止。\n\n${content}\n\n黑暗吞噬了一切，由于你的大意，你没能逃离这个地方。`
        };
        return c.json(mockResponse);
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

// ------------------------------------------------------------------------
// 4. 配色生成接口：根据标题风格返回 5 个十六进制颜色
// ------------------------------------------------------------------------
app.post('/generate-colors', async (c) => {
    try {
        const { title } = await c.req.json<{ title: string }>();
        console.log(`Generating colors for title: ${title}`);
        const mockColors = ["#1a1a2e", "#16213e", "#0f3460", "#e94560", "#ffffff"];
        return c.json({ colors: mockColors });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});


app.post('/generate-image', async (c) => {
    try {
        const { content } = await c.req.json<{ content: string }>();
        console.log(`Generating image for content: ${content}`);
        const mockImageUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500";
        return c.json({ imageUrl: mockImageUrl });
    } catch (err: any) {
        return c.json({ error: err.message }, 500);
    }
});

export const onRequest = handle(app);