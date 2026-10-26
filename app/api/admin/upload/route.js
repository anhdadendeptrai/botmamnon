import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { saveDoc } from '@/lib/kb';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Làm sạch text: xoá khoảng trắng thừa, dòng trống liên tiếp.
 */
function cleanText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/(\n\s*){3,}/g, '\n\n')
        .replace(/^\s+|\s+$/gm, '')
        .trim();
}

export async function POST(request) {
    if (!(await isAdmin())) {
        return NextResponse.json({ error: 'Chưa xác thực.' }, { status: 401 });
    }

    let formData;
    try {
        formData = await request.formData();
    } catch {
        return NextResponse.json({ error: 'Không đọc được form data.' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
        return NextResponse.json({ error: 'Thiếu file.' }, { status: 400 });
    }

    const filename = file.name || 'unknown';
    const ext = filename.toLowerCase().split('.').pop();

    if (!['doc', 'docx'].includes(ext)) {
        return NextResponse.json(
            { error: `Định dạng không hỗ trợ: .${ext}. Chỉ chấp nhận .doc và .docx.` },
            { status: 400 }
        );
    }

    let rawText = '';

    try {
        const buffer = Buffer.from(await file.arrayBuffer());

        if (ext === 'docx') {
            const mammoth = (await import('mammoth')).default;
            const result = await mammoth.extractRawText({ buffer });
            rawText = result.value || '';
        } else {
            // .doc
            const WordExtractor = (await import('word-extractor')).default;
            const extractor = new WordExtractor();
            // word-extractor nhận file path hoặc Buffer
            const extracted = await extractor.extract(buffer);
            rawText = extracted.getBody() || '';
        }
    } catch (err) {
        console.error(`[Admin Upload] Lỗi đọc file ${filename}:`, err.message);
        return NextResponse.json(
            { error: `Không đọc được file "${filename}": ${err.message}` },
            { status: 422 }
        );
    }

    const content = cleanText(rawText);

    if (!content || content.length === 0) {
        return NextResponse.json(
            {
                error: `File "${filename}" không có chữ (có thể là file scan/ảnh hoặc file rỗng).`,
            },
            { status: 422 }
        );
    }

    // Tạo title từ tên file (bỏ đuôi)
    const title = filename.replace(/\.(doc|docx)$/i, '').trim();

    try {
        const doc = await saveDoc({ title, content });
        return NextResponse.json({ ok: true, id: doc.id, title: doc.title, length: content.length });
    } catch (err) {
        console.error(`[Admin Upload] Lỗi lưu doc ${filename}:`, err.message);
        return NextResponse.json({ error: 'Lỗi lưu vào database.' }, { status: 500 });
    }
}
