import { NextResponse } from 'next/server';
import { loadDocs } from '@/lib/loadDocs';
import { searchDocs } from '@/lib/searchDocs';
import { askGemini } from '@/lib/geminiClient';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    const reqStartTime = Date.now();
    console.log('\n🟢 [CHAT API] New request at', new Date().toISOString());

    try {
        const { message, history } = await request.json();
        console.log('[CHAT API] Message:', message);
        console.log('[CHAT API] History items:', history?.length || 0);

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return NextResponse.json(
                { reply: 'Phụ huynh vui lòng nhập câu hỏi ạ.' },
                { status: 400 }
            );
        }

        const safeHistory = Array.isArray(history) ? history : [];

        // Step 1: Load docs (cached after first call)
        const t1 = Date.now();
        const docs = await loadDocs();
        console.log(`[CHAT API] Step 1 - Load docs: ${Date.now() - t1}ms (${docs.length} docs)`);

        // Step 2: Search for relevant context
        const t2 = Date.now();
        const context = searchDocs(message.trim(), docs);
        console.log(`[CHAT API] Step 2 - Search: ${Date.now() - t2}ms (context: ${context.length} chars)`);

        // Step 3: Ask Gemini
        const t3 = Date.now();
        const reply = await askGemini(context, message.trim(), safeHistory);
        console.log(`[CHAT API] Step 3 - Gemini: ${Date.now() - t3}ms`);
        console.log(`[CHAT API] ✅ Total time: ${Date.now() - reqStartTime}ms`);

        return NextResponse.json({ reply });
    } catch (error) {
        console.error(`[CHAT API] ❌ Error after ${Date.now() - reqStartTime}ms:`, error.message);
        console.error('[CHAT API] Error name:', error.name, '| Status:', error?.status);
        console.error('[CHAT API] Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));

        const errorMessage = error.message?.includes('GEMINI_API_KEY')
            ? error.message
            : 'Hiện tại hệ thống đang gặp sự cố. Phụ huynh vui lòng thử lại sau ạ.';

        return NextResponse.json(
            { reply: errorMessage },
            { status: 500 }
        );
    }
}
