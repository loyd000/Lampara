/**
 * Image Cache Utility
 * Caches image URLs in localStorage with configurable TTL
 */

const CACHE_KEY_PREFIX = 'lampara_img_cache_';
const CACHE_EXPIRY_HOURS = 24; // Cache for 24 hours

/**
 * Get cached image URL or fetch and cache it
 * @param {string} url - Image URL to cache
 * @param {number} expiryHours - Cache expiry time in hours (default: 24)
 * @returns {string} Cached or original URL
 */
export function getCachedImageUrl(url, expiryHours = CACHE_EXPIRY_HOURS) {
    if (!url) return url;
    
    const cacheKey = CACHE_KEY_PREFIX + btoa(url); // Base64 encode URL as key
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
        const { data, expiry } = JSON.parse(cached);
        if (Date.now() < expiry) {
            return data; // Return cached URL if not expired
        } else {
            localStorage.removeItem(cacheKey); // Remove expired cache
        }
    }
    
    // Cache the URL with expiry time
    const expiry = Date.now() + (expiryHours * 60 * 60 * 1000);
    localStorage.setItem(cacheKey, JSON.stringify({ data: url, expiry }));
    
    return url;
}

/**
 * Clear all cached images
 */
export function clearImageCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
            localStorage.removeItem(key);
        }
    });
}

/**
 * Clear expired cache entries
 */
export function cleanExpiredCache() {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith(CACHE_KEY_PREFIX)) {
            try {
                const { expiry } = JSON.parse(localStorage.getItem(key));
                if (Date.now() >= expiry) {
                    localStorage.removeItem(key);
                }
            } catch (e) {
                localStorage.removeItem(key);
            }
        }
    });
}

/**
 * Get cache statistics
 * @returns {object} Cache stats
 */
export function getCacheStats() {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith(CACHE_KEY_PREFIX));
    let expired = 0;
    let valid = 0;
    
    cacheKeys.forEach(key => {
        try {
            const { expiry } = JSON.parse(localStorage.getItem(key));
            if (Date.now() >= expiry) {
                expired++;
            } else {
                valid++;
            }
        } catch (e) {
            expired++;
        }
    });
    
    return {
        total: cacheKeys.length,
        valid,
        expired,
        sizeKB: new Blob(cacheKeys.map(k => localStorage.getItem(k))).size / 1024
    };
}
