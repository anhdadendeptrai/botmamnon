import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { getIndex, getDoc, saveDoc, deleteDoc } from '@/lib/kb';

export const dynamic = 'force-dynamic';

const MAX_CONTENT_LENGTH = 2_000_000; // 2 triệu ký tự

export async function GET(request) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: 'Chưa xác thực.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
        const doc = await getDoc(id);
        if (!doc) return NextResponse.json({ error: 'Không tìm thấy.' }, { status: 404 });
        return NextResponse.json(doc);
    }

    const index = await getIndex();
    return NextResponse.json(index);
}

export async function POST(request) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: 'Chưa xác thực.' }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Body không hợp lệ.' }, { status: 400 });
    }

    const { id, title, content } = body || {};

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json({ error: 'Tiêu đề không được để trống.' }, { status: 400 });
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return NextResponse.json({ error: 'Nội dung không được để trống.' }, { status: 400 });
    }
    if (content.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json(
            { error: `Nội dung quá dài (tối đa ${MAX_CONTENT_LENGTH.toLocaleString()} ký tự).` },
            { status: 400 }
        );
    }

    try {
        const doc = await saveDoc({ id: id || undefined, title, content });
        return NextResponse.json(doc);
    } catch (err) {
        console.error('[Admin Docs POST]', err.message);
        return NextResponse.json({ error: 'Lỗi lưu tài liệu.' }, { status: 500 });
    }
}

export async function DELETE(request) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: 'Chưa xác thực.' }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Body không hợp lệ.' }, { status: 400 });
    }

    const { id } = body || {};
    if (!id || typeof id !== 'string') {
        return NextResponse.json({ error: 'Thiếu id.' }, { status: 400 });
    }

    try {
        await deleteDoc(id);
        return NextResponse.json({ ok: true });
    } catch (err) {
        console.error('[Admin Docs DELETE]', err.message);
        return NextResponse.json({ error: 'Lỗi xóa tài liệu.' }, { status: 500 });
    }
}
