import {
    authenticate,
    applyCors,
    applyRateLimit,
    handlePreflight,
    requireMethod,
    sendError,
} from '../v1/_shared.js';

export {
    authenticate,
    applyCors,
    applyRateLimit,
    handlePreflight,
    requireMethod,
    sendError,
};

export function setNoCache(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}
