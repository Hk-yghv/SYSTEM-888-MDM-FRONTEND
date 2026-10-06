import { createReadStream } from 'node:fs';

const wrappedBots = new WeakSet();
const MAX_RETRY_DELAY_MS = 60_000;

const wait = (durationMs) => new Promise(resolve => setTimeout(resolve, durationMs));

const getRetryDelay = (attempt, error) => {
    const retryAfterSeconds = Number(error?.response?.body?.parameters?.retry_after);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000;
    }
    return Math.min(MAX_RETRY_DELAY_MS, 1000 * (2 ** Math.min(attempt - 1, 6)));
};

const cloneRetryArgs = (args) => {
    const clone = (value) => {
        if (Array.isArray(value)) return value.map(clone);
        if (!value || typeof value !== 'object' || Buffer.isBuffer(value)) return value;
        if (typeof value.pipe === 'function' && typeof value.path === 'string') {
            return createReadStream(value.path);
        }
        if (Object.getPrototypeOf(value) !== Object.prototype) return value;
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
    };
    return args.map(clone);
};

export const installTelegramSendRetry = (bot) => {
    if (!bot || wrappedBots.has(bot)) return;
    wrappedBots.add(bot);

    const methods = new Set();
    for (let prototype = Object.getPrototypeOf(bot); prototype && prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
        for (const methodName of Object.getOwnPropertyNames(prototype)) {
            if (/^(send|copy|forward)[A-Z]/.test(methodName) && typeof bot[methodName] === 'function') {
                methods.add(methodName);
            }
        }
    }

    for (const methodName of methods) {
        const originalMethod = bot[methodName].bind(bot);
        Object.defineProperty(bot, methodName, {
            configurable: true,
            value: async (...args) => {
                let attempt = 0;
                while (true) {
                    attempt += 1;
                    try {
                        return await originalMethod(...(attempt === 1 ? args : cloneRetryArgs(args)));
                    } catch (error) {
                        const delayMs = getRetryDelay(attempt, error);
                        console.error(`[TelegramBot] ${methodName} failed (attempt ${attempt}); retrying in ${delayMs}ms: ${error.message}`);
                        await wait(delayMs);
                    }
                }
            }
        });
    }
};
