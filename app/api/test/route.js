import { NextResponse } from 'next/server';
import { loadDocs } from '@/lib/loadDocs';
import { searchDocs } from '@/lib/searchDocs';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';

// GET /api/test — Truy cập bằng trình duyệt để tự test toàn bộ hệ thống
export async function GET() {
    const results = {
        timestamp: new Date().toISOString(),
        tests: {},
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
        }
    };

    // ===== TEST 1: Environment Variables =====
    try {
        const geminiKey = process.env.GEMINI_API_KEY;
        const ttsKey = process.env.GOOGLE_TTS_API_KEY;

        results.tests.envVars = {
            status: geminiKey ? '✅ PASS' : '❌ FAIL',
            GEMINI_API_KEY: geminiKey
                ? { exists: true, prefix: geminiKey.substring(0, 10) + '...', length: geminiKey.length }
                : { exists: false, error: 'MISSING! Cần set GEMINI_API_KEY trong Vercel Environment Variables' },
            GOOGLE_TTS_API_KEY: ttsKey
                ? { exists: true, prefix: ttsKey.substring(0, 10) + '...', length: ttsKey.length }
                : { exists: false, note: 'Optional - dùng cho Text-to-Speech' },
        };
    } catch (err) {
        results.tests.envVars = { status: '❌ ERROR', error: err.message };
    }

    // ===== TEST 2: Load Documents =====
    try {
        const startTime = Date.now();
        const docs = await loadDocs();
        const elapsed = Date.now() - startTime;

        results.tests.loadDocs = {
            status: docs.length > 0 ? '✅ PASS' : '⚠️ WARNING - No docs found',
            totalDocs: docs.length,
            loadTimeMs: elapsed,
            docs: docs.map(d => ({
                filename: d.filename,
                title: d.title,
                contentLength: d.content.length,
                hasIndex: !!d._index,
                wordCount: d._index?.wordFreq?.size || 'N/A',
            })),
        };
    } catch (err) {
        results.tests.loadDocs = { status: '❌ ERROR', error: err.message, stack: err.stack };
    }

    // ===== TEST 3: Search =====
    try {
        const docs = await loadDocs();
        const testQuery = 'giới thiệu trường';
        const startTime = Date.now();
        const context = searchDocs(testQuery, docs);
        const elapsed = Date.now() - startTime;

        results.tests.search = {
            status: context.length > 0 ? '✅ PASS' : '⚠️ WARNING - No results',
            query: testQuery,
            searchTimeMs: elapsed,
            contextLength: context.length,
            contextPreview: context.substring(0, 300) + (context.length > 300 ? '...' : ''),
        };
    } catch (err) {
        results.tests.search = { status: '❌ ERROR', error: err.message, stack: err.stack };
    }

    // ===== TEST 4: Gemini API Connection =====
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            results.tests.geminiAPI = {
                status: '❌ SKIP',
                error: 'Không thể test vì GEMINI_API_KEY chưa được cấu hình',
            };
        } else {
            const genAI = new GoogleGenerativeAI(apiKey);

            // Test 4a: List models để kiểm tra API key có hợp lệ
            let modelTestResult = 'unknown';
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const startTime = Date.now();
                const result = await model.generateContent('Trả lời đúng 2 từ: Xin chào');
                const response = await result.response;
                const text = response.text();
                const elapsed = Date.now() - startTime;

                modelTestResult = {
                    status: '✅ PASS',
                    model: 'gemini-2.5-flash',
                    responseTimeMs: elapsed,
                    response: text.substring(0, 200),
                };
            } catch (modelErr) {
                modelTestResult = {
                    status: '❌ FAIL',
                    model: 'gemini-2.5-flash',
                    errorName: modelErr.name,
                    errorMessage: modelErr.message,
                    errorStatus: modelErr.status,
                    errorDetails: JSON.stringify(modelErr, Object.getOwnPropertyNames(modelErr), 2).substring(0, 1000),
                };

                // Fallback: try other model names
                const fallbackModels = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-pro'];
                for (const fallbackName of fallbackModels) {
                    try {
                        const fbModel = genAI.getGenerativeModel({ model: fallbackName });
                        const fbResult = await fbModel.generateContent('Trả lời đúng 2 từ: Xin chào');
                        const fbResponse = await fbResult.response;
                        const fbText = fbResponse.text();

                        modelTestResult.fallbackSuccess = {
                            model: fallbackName,
                            response: fbText.substring(0, 200),
                            note: `Model ${fallbackName} HOẠT ĐỘNG! Cần đổi model trong geminiClient.js`,
                        };
                        break;
                    } catch {
                        // skip, try next
                    }
                }
            }

            results.tests.geminiAPI = modelTestResult;
        }
    } catch (err) {
        results.tests.geminiAPI = {
            status: '❌ ERROR',
            error: err.message,
            stack: err.stack?.substring(0, 500),
        };
    }

    // ===== TEST 5: Full Pipeline (simulate a real chat request) =====
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            results.tests.fullPipeline = { status: '❌ SKIP', reason: 'No API key' };
        } else {
            const docs = await loadDocs();
            const testMessage = 'giờ đón trả trẻ';
            const context = searchDocs(testMessage, docs);

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({
                model: 'gemini-2.5-flash',
                systemInstruction: 'Bạn là trợ lý AI trường mầm non. Trả lời ngắn gọn.'
            });

            const startTime = Date.now();
            const chat = model.startChat({ history: [] });
            const prompt = context.length > 0
                ? `Dựa vào nội dung sau:\n${context.substring(0, 2000)}\n\nTrả lời: ${testMessage}`
                : `Trả lời: ${testMessage}`;

            const result = await chat.sendMessage(prompt);
            const response = await result.response;
            const text = response.text();
            const elapsed = Date.now() - startTime;

            results.tests.fullPipeline = {
                status: '✅ PASS',
                message: testMessage,
                contextFound: context.length > 0,
                responseTimeMs: elapsed,
                reply: text.substring(0, 500),
            };
        }
    } catch (err) {
        results.tests.fullPipeline = {
            status: '❌ FAIL',
            error: err.message,
            errorName: err.name,
            errorDetails: JSON.stringify(err, Object.getOwnPropertyNames(err), 2).substring(0, 1000),
        };
    }

    // ===== Summary =====
    const allStatuses = Object.values(results.tests).map(t => t.status || '');
    results.summary = {
        totalTests: Object.keys(results.tests).length,
        passed: allStatuses.filter(s => s.includes('PASS')).length,
        failed: allStatuses.filter(s => s.includes('FAIL')).length,
        warnings: allStatuses.filter(s => s.includes('WARNING')).length,
    };

    return NextResponse.json(results, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
