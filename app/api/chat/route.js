import { NextResponse } from 'next/server';
import { loadDocs } from '@/lib/loadDocs';
import { searchDocs } from '@/lib/searchDocs';
import { askGemini } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const { message, history } = await request.json();

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json(
                { reply: 'Phụ huynh vui lòng nhập câu hỏi ạ.' },
                { status: 400 }
            );
        }

        const safeHistory = Array.isArray(history) ? history : [];

        // Step 1: Load docs (cached after first call)
        const docs = await loadDocs();

        // Step 2: Search for relevant context
        const context = searchDocs(message.trim(), docs);

        // Step 3: Ask Gemini
        const reply = await askGemini(context, message.trim(), safeHistory);

        return NextResponse.json({ reply });
    } catch (error) {
        console.error('Chat API Error:', error);

        const errorMessage = error.message?.includes('GEMINI_API_KEY')
            ? error.message
            : 'Hiện tại hệ thống đang gặp sự cố. Phụ huynh vui lòng thử lại sau ạ.';

        return NextResponse.json(
            { reply: errorMessage },
            { status: 500 }
        );
    }
}
