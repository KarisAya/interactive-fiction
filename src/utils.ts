export async function streamReader(reader: ReadableStreamDefaultReader<Uint8Array>, onChunk: (chunk: string) => Promise<void>) {
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
            const cleanedLine = line.trim();
            if (!cleanedLine) continue;
            if (!cleanedLine.startsWith('data:')) continue;
            const dataStr = cleanedLine[5] === " " ? cleanedLine.slice(6) : cleanedLine.slice(5);
            if (dataStr === '[DONE]') return;
            try { await onChunk(dataStr) }
            catch (e) { console.error(`Failed to parse SSE: ${e}\nLine: ${cleanedLine}`); }
        }
        if (done) return;
    }
}

type OnChunkCallback = (key: string, chunk: string) => Promise<void>;

export class OneLayerStreamJSONParser {
    private currentKey: string = "";
    private currentValChunk: string = "";
    private inKeyQuotes: boolean = false;
    private inVal: boolean = false;
    private inValBar: string[] = []; // '"', '[', '{'
    private endVar: boolean = false;
    private lstrip: boolean = false;
    private pairValBar(ket: string) {
        if (ket !== ',' && ket !== ']' && ket !== '}') return false;
        if (this.inValBar.length === 0) return true;
        let count = 0;
        let i = this.inValBar.length - 1
        while ((i >= 0) && (this.inValBar[i] === '"')) {
            i--;
            count++;
        }
        if (count % 2 === 1) return false;
        if (ket === ',') {
            this.inValBar.length = i + 1
            return this.inValBar.length === 0;
        }
        const bar = this.inValBar[i];
        if ((bar === '[' && ket === ']') || (bar === '{' && ket === '}')) {
            this.inValBar.length = i;
            return this.inValBar.length === 0;
        }
        return false;
    }
    public onChunk: OnChunkCallback | null = null;
    public async write(chunk: string) {
        for (let i = 0; i < chunk.length; i++) {
            const char = chunk[i];
            if (this.lstrip) {
                if (char === ' ') { continue; }
                else (this.lstrip = false)
            }

            if (this.inVal) {
                if (char === "," && this.inValBar.length === 0) {
                    this.endVar = true;
                } else {
                    if (char === '"' || char === '[' || char === '{') {
                        this.inValBar.push(char);
                        this.currentValChunk += char;
                    }
                    else if (this.pairValBar(char)) {
                        this.endVar = true;
                        if (char !== ',') this.currentValChunk += char;
                    }
                    else { this.currentValChunk += char; }
                }
            }
            else {
                if (char === '"') { this.inKeyQuotes = !this.inKeyQuotes; continue; }
                if (this.inKeyQuotes) { this.currentKey += char; }
                else if (char === ':') {
                    this.inVal = true;
                    this.lstrip = true;
                    continue;
                }
            }
            if (this.endVar) {
                await this.onChunk!(this.currentKey, this.currentValChunk);
                this.currentValChunk = "";
                this.currentKey = "";
                this.endVar = false;
                this.inVal = false;
            }
        }
        if (this.currentKey && this.currentValChunk) {
            await this.onChunk!(this.currentKey, this.currentValChunk);
            this.currentValChunk = "";
        }
    }
}