import { getAllDocs } from './kb.js';

/**
 * Làm sạch text: xoá khoảng trắng thừa, dòng trống liên tiếp.
 */
function cleanText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')          // Nhiều space/tab => 1 space
        .replace(/(\n\s*){3,}/g, '\n\n')   // 3+ dòng trống => 2 dòng
        .replace(/^\s+|\s+$/gm, '')        // Trim mỗi dòng
        .trim();
}

let cachedDocs = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 1000; // 60 giây cache để giảm đọc Redis

// Pre-compute search index for each doc at load time
function buildSearchIndex(doc) {
    const contentLower = (doc.content || '').toLowerCase();
    const titleLower = (doc.title || '').toLowerCase();
    // Dùng title làm filename để tương thích với searchDocs
    const filenameLower = titleLower;

    const words = contentLower
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);

    const wordFreq = new Map();
    for (const w of words) {
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }

    return {
        ...doc,
        filename: doc.title || '', // tương thích searchDocs
        _index: { contentLower, titleLower, filenameLower, wordFreq }
    };
}

export async function loadDocs() {
    if (cachedDocs && (Date.now() - cacheTimestamp < CACHE_TTL_MS)) return cachedDocs;

    console.log('[loadDocs] Tải tài liệu từ Redis...');
    const startTime = Date.now();

    try {
        const rawDocs = await getAllDocs();

        const docs = rawDocs
            .filter(d => d && d.title && d.content)
            .map(d => buildSearchIndex({
                ...d,
                content: cleanText(d.content),
            }));

        cachedDocs = docs;
        cacheTimestamp = Date.now();
        console.log(`[loadDocs] ✅ Hoàn tất: ${docs.length} tài liệu trong ${Date.now() - startTime}ms`);
        return cachedDocs;
    } catch (err) {
        console.error('[loadDocs] ❌ Lỗi tải từ Redis:', err.message);
        // Nếu lỗi mà còn cache cũ thì dùng tạm
        if (cachedDocs) {
            console.log('[loadDocs] ⚠️ Dùng cache cũ do lỗi Redis.');
            return cachedDocs;
        }
        return [];
    }
}
