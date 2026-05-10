export class HttpTimeoutError extends Error {
    statusCode: number;

    constructor(message = 'Upstream request timed out') {
        super(message);
        this.name = 'HttpTimeoutError';
        this.statusCode = 504;
    }
}

export async function fetchWithTimeout(
    input: RequestInfo | URL,
    init: RequestInit = {},
    timeoutMs = 20000,
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof (timeout as NodeJS.Timeout).unref === 'function') {
        timeout.unref();
    }

    try {
        return await fetch(input, {
            ...init,
            signal: controller.signal,
        });
    } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
            throw new HttpTimeoutError(`Upstream request timed out after ${timeoutMs}ms`);
        }
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}
