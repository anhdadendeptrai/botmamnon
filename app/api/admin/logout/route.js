import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
    const admin = await isAdmin();
    if (!admin) {
        return NextResponse.json({ error: 'Chưa xác thực.' }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set('admin', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 0,
    });
    return response;
}
