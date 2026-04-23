/**
 * Rate Limiting Utility
 * Client-side rate limiting to prevent spam submissions
 */

const RATE_LIMIT_STORE = new Map(); // In-memory store for rate limit tracking

/**
 * Rate limit configuration
 */
const DEFAULT_CONFIG = {
    maxAttempts: 5,      // Max attempts within time window
    windowMs: 60000,     // Time window in milliseconds (1 minute)
    blockDurationMs: 300000, // Block duration in milliseconds (5 minutes)
};

/**
 * Check if action is rate limited
 * @param {string} key - Unique identifier for the action (e.g., 'contact_form', 'user_123')
 * @param {object} config - Rate limit configuration
 * @returns {object} { isLimited: boolean, remaining: number, retryAfter: number }
 */
export function checkRateLimit(key, config = DEFAULT_CONFIG) {
    const now = Date.now();
    let record = RATE_LIMIT_STORE.get(key);
    
    // Initialize record if it doesn't exist
    if (!record) {
        record = { attempts: [], blockUntil: 0 };
        RATE_LIMIT_STORE.set(key, record);
    }

    // Reset record if a prior block has fully expired
    if (record.blockUntil > 0 && now > record.blockUntil) {
        record.attempts = [];
        record.blockUntil = 0;
    }
    
    // Check if currently blocked
    if (now < record.blockUntil) {
        return {
            isLimited: true,
            remaining: 0,
            retryAfter: Math.ceil((record.blockUntil - now) / 1000),
        };
    }
    
    // Clean old attempts outside the time window
    record.attempts = record.attempts.filter(t => now - t < config.windowMs);
    
    // Check if limit exceeded
    if (record.attempts.length >= config.maxAttempts) {
        record.blockUntil = now + config.blockDurationMs;
        return {
            isLimited: true,
            remaining: 0,
            retryAfter: Math.ceil(config.blockDurationMs / 1000),
        };
    }
    
    // Record this attempt
    record.attempts.push(now);
    const remaining = config.maxAttempts - record.attempts.length;
    
    return {
        isLimited: false,
        remaining,
        retryAfter: 0,
    };
}

/**
 * Reset rate limit for a key
 * @param {string} key - Unique identifier
 */
export function resetRateLimit(key) {
    RATE_LIMIT_STORE.delete(key);
}

/**
 * Clear all rate limits
 */
export function clearAllRateLimits() {
    RATE_LIMIT_STORE.clear();
}

/**
 * Get rate limit status for a key
 * @param {string} key - Unique identifier
 * @returns {object} Rate limit stats
 */
export function getRateLimitStatus(key) {
    const record = RATE_LIMIT_STORE.get(key);
    if (!record) {
        return { tracked: false, attempts: 0, blocked: false };
    }
    return {
        tracked: true,
        attempts: record.attempts.length,
        blocked: Date.now() < record.blockUntil,
    };
}

/**
 * Create a rate limit middleware for form submissions
 * @param {string} formId - Unique form identifier
 * @param {object} config - Rate limit configuration
 * @returns {function} Middleware function
 */
export function createFormRateLimiter(formId, config = DEFAULT_CONFIG) {
    return function(callback) {
        return async function(...args) {
            const limit = checkRateLimit(formId, config);
            if (limit.isLimited) {
                console.warn(`Form submission rate limited. Retry after ${limit.retryAfter} seconds`);
                throw new Error(`Too many submissions. Please wait ${limit.retryAfter} seconds before trying again.`);
            }
            return callback(...args);
        };
    };
}
