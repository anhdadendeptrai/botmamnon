import { getRedis } from './redis.js';
import crypto from 'crypto';

const INDEX_KEY = 'docs:index';

/**
 * Lấy danh sách tài liệu nhẹ [{id, title, length}] để hiển thị ở admin.
 */
export async function getIndex() {
    const redis = await getRedis();
    const raw = await redis.get(INDEX_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

/**
 * Lấy nội dung đầy đủ một tài liệu theo id.
 */
export async function getDoc(id) {
    const redis = await getRedis();
    const raw = await redis.get(`doc:${id}`);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Lưu tài liệu. Nếu có id → cập nhật, không có → tạo mới.
 * Cập nhật đồng thời docs:index.
 * Nếu trùng title với tài liệu đã tồn tại → ghi đè tài liệu đó.
 */
export async function saveDoc({ id, title, content }) {
    const redis = await getRedis();
    const index = await getIndex();

    // Kiểm tra trùng title (để tránh nhân đôi khi upload lại)
    if (!id) {
        const existingEntry = index.find(
            (d) => d.title.trim().toLowerCase() === title.trim().toLowerCase()
        );
        if (existingEntry) {
            id = existingEntry.id;
        }
    }

    const docId = id || crypto.randomUUID();
    const doc = { id: docId, title: title.trim(), content };

    // Lưu doc riêng lẻ — node-redis không tự serialize, phải JSON.stringify
    await redis.set(`doc:${docId}`, JSON.stringify(doc));

    // Cập nhật index
    const entry = { id: docId, title: title.trim(), length: content.length };
    const existingIdx = index.findIndex((d) => d.id === docId);
    if (existingIdx >= 0) {
        index[existingIdx] = entry;
    } else {
        index.push(entry);
    }
    await redis.set(INDEX_KEY, JSON.stringify(index));

    return doc;
}

/**
 * Xóa tài liệu theo id, cập nhật index.
 */
export async function deleteDoc(id) {
    const redis = await getRedis();
    await redis.del(`doc:${id}`);
    const index = await getIndex();
    const newIndex = index.filter((d) => d.id !== id);
    await redis.set(INDEX_KEY, JSON.stringify(newIndex));
}

/**
 * Lấy toàn bộ nội dung tài liệu (dùng cho bot).
 * node-redis mget nhận mảng string[], trả về mảng string|null.
 */
export async function getAllDocs() {
    const redis = await getRedis();
    const index = await getIndex();
    if (!index || index.length === 0) return [];

    const keys = index.map((d) => `doc:${d.id}`);
    // node-redis v4+: mGet nhận string[] (không phải spread)
    const results = await redis.mGet(keys);

    const docs = [];
    for (const raw of results) {
        if (!raw) continue;
        try {
            const doc = JSON.parse(raw);
            if (doc && doc.title && doc.content) {
                docs.push(doc);
            }
        } catch {
            // bỏ qua doc lỗi parse
        }
    }
    return docs;
}
