import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { checkPassword, makeAdminToken, COOKIE_OPTIONS } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    let ip = 'unknown';
    try {
        ip =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown';
    } catch { /* bỏ qua */ }

    const rateLimitKey = `ratelimit:login:${ip}`;

    try {
        const redis = await getRedis();

        // --- Rate limit: tối đa 5 lần sai / 15 phút ---
        const attempts = await redis.get(rateLimitKey);
        if (attempts && parseInt(attempts, 10) >= 5) {
            return NextResponse.json(
                { error: 'Quá nhiều lần đăng nhập sai. Vui lòng thử lại sau 15 phút.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { password } = body || {};

        if (!password || typeof password !== 'string') {
            return NextResponse.json({ error: 'Thiếu mật khẩu.' }, { status: 400 });
        }

        const ok = checkPassword(password);

        if (!ok) {
            // Tăng bộ đếm thất bại, tự hết hạn sau 15 phút
            const current = parseInt(attempts || '0', 10);
            await redis.set(rateLimitKey, String(current + 1), { EX: 15 * 60 });
            return NextResponse.json({ error: 'Mật khẩu không đúng.' }, { status: 401 });
        }

        // Xóa bộ đếm khi đăng nhập thành công
        await redis.del(rateLimitKey);

        const token = makeAdminToken();
        const response = NextResponse.json({ ok: true });
        response.cookies.set('admin', token, COOKIE_OPTIONS);
        return response;
    } catch (err) {
        console.error('[Admin Login] Error:', err.message);
        return NextResponse.json(
            { error: 'Lỗi hệ thống. Vui lòng thử lại.' },
            { status: 500 }
        );
    }
}
