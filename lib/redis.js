import { createClient } from 'redis';

/**
 * Lazy singleton promise.
 * - Lần đầu gọi getRedis(): tạo client, connect(), cache promise.
 * - Các lần sau: trả về promise đã resolve → không mở thêm kết nối.
 * Phù hợp với Vercel serverless (mỗi worker giữ 1 connection trong suốt vòng đời).
 */
let clientPromise = null;

export function getRedis() {
    if (clientPromise) return clientPromise;

    const url = process.env.REDIS_URL
        || process.env.KV_URL
        || process.env.REDIS_REST_URL;

    if (!url) {
        throw new Error(
            'Redis chưa được cấu hình. Thêm REDIS_URL (hoặc KV_URL) vào biến môi trường.'
        );
    }

    clientPromise = (async () => {
        const client = createClient({ url });

        client.on('error', (err) => {
            console.error('[Redis] Client error:', err.message);
        });

        await client.connect();
        console.log('[Redis] Đã kết nối thành công.');
        return client;
    })();

    return clientPromise;
}
