import crypto from 'crypto';
import { cookies } from 'next/headers';

/**
 * Tính HMAC-SHA256 của message với secret.
 */
function hmac(secret, message) {
    return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * So sánh hai chuỗi theo thời gian không đổi (chống timing attack).
 */
function timingSafeEqual(a, b) {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) {
        // Vẫn phải so sánh để không leak thông tin thời gian
        crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Sinh giá trị cookie admin hợp lệ.
 */
export function makeAdminToken() {
    const secret = process.env.ADMIN_SECRET;
    if (!secret) throw new Error('ADMIN_SECRET chưa được cấu hình.');
    return hmac(secret, 'admin');
}

/**
 * Kiểm tra request có cookie admin hợp lệ không.
 * Dùng trong Server Components và Route Handlers.
 */
export async function isAdmin() {
    try {
        const cookieStore = await cookies();
        const cookie = cookieStore.get('admin');
        if (!cookie?.value) return false;
        const expected = makeAdminToken();
        return timingSafeEqual(cookie.value, expected);
    } catch {
        return false;
    }
}

/**
 * Kiểm tra mật khẩu admin.
 */
export function checkPassword(input) {
    const password = process.env.ADMIN_PASSWORD;
    if (!password) throw new Error('ADMIN_PASSWORD chưa được cấu hình.');
    const bufInput = Buffer.from(input, 'utf8');
    const bufPassword = Buffer.from(password, 'utf8');
    if (bufInput.length !== bufPassword.length) {
        crypto.timingSafeEqual(bufInput, Buffer.alloc(bufInput.length));
        return false;
    }
    return crypto.timingSafeEqual(bufInput, bufPassword);
}

/**
 * Thuộc tính cookie admin.
 */
export const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 ngày tính bằng giây
};
