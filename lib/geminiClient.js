import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Bạn là Trợ lý AI Trường mầm non Ninh Lai.
Hỗ trợ phụ huynh giải đáp thắc mắc nhanh chóng, chính xác và thân thiện dựa trên nội dung được cung cấp.

THÔNG TIN CHUNG:
- Địa chỉ: thôn Hội Tân, xã Sơn Thuỷ, tỉnh Tuyên Quang
- Số điện thoại liên hệ: 0373194186

QUY TẮC:
- CHỈ trả lời dựa trên TÀI LIỆU được cung cấp trong câu hỏi. KHÔNG bịa đặt.
- Nếu không có tài liệu kèm theo, đó là câu chào hỏi/cảm ơn/tạm biệt => đáp lại thân thiện.
- Nếu có tài liệu nhưng không đủ thông tin => hướng dẫn liên hệ SĐT 0373194186.
- Trả lời ngắn gọn, dùng emoji, xưng "em"/"nhà trường" - "bố/mẹ"/"phụ huynh".
- Không chào lại ở đầu câu. Không nêu đích danh tên giáo viên/hiệu trưởng.`;

// Giới hạn lịch sử hội thoại gửi cho Gemini (số cặp user-model gần nhất)
const MAX_HISTORY_PAIRS = 4;

// Số lần retry khi gặp lỗi tạm thời (rate limit, server error)
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function askGemini(context, question, history = []) {
    console.log('[GEMINI] Q:', question.slice(0, 80), '| ctx:', context?.length || 0, 'chars | hist:', history?.length || 0);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your_api_key_here') {
        throw new Error('GEMINI_API_KEY chưa được cấu hình.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT
    });

    // === Xử lý history: đảm bảo đúng format user/model xen kẽ ===
    let validHistory = [];
    let nextExpectedRole = 'user';

    for (const msg of history) {
        if (!msg.content || msg.content.trim().length === 0) continue;

        const mappedRole = msg.role === 'bot' ? 'model' : 'user';

        if (mappedRole === nextExpectedRole) {
            validHistory.push({
                role: mappedRole,
                parts: [{ text: msg.content }]
            });
            nextExpectedRole = mappedRole === 'user' ? 'model' : 'user';
        } else if (validHistory.length > 0) {
            validHistory[validHistory.length - 1].parts[0].text += '\n\n' + msg.content;
        }
    }

    // Đảm bảo history kết thúc bằng 'model' (không phải 'user')
    if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
        validHistory.pop();
    }

    // === GIỚI HẠN HISTORY: chỉ giữ N cặp gần nhất ===
    const maxEntries = MAX_HISTORY_PAIRS * 2; // mỗi cặp = 1 user + 1 model
    if (validHistory.length > maxEntries) {
        validHistory = validHistory.slice(-maxEntries);
        // Đảm bảo history bắt đầu bằng 'user'
        if (validHistory.length > 0 && validHistory[0].role === 'model') {
            validHistory.shift();
        }
    }

    if (validHistory.length > 0) console.log('[GEMINI] History (trimmed):', validHistory.length, 'entries');

    let finalQuestion;
    if (context && context.trim().length > 0) {
        finalQuestion = `TÀI LIỆU:\n${context}\n\nCÂU HỎI: ${question}`;
    } else {
        finalQuestion = question;
    }

    // === Retry logic cho lỗi tạm thời ===
    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (attempt > 0) {
                const delay = RETRY_DELAY_MS * attempt;
                console.log(`[GEMINI] ⏳ Retry ${attempt}/${MAX_RETRIES} sau ${delay}ms...`);
                await sleep(delay);
            }

            const chat = model.startChat({ history: validHistory });
            const startTime = Date.now();
            const result = await chat.sendMessage(finalQuestion);
            const response = await result.response;
            const text = response.text();
            console.log(`[GEMINI] ✅ ${Date.now() - startTime}ms | attempt: ${attempt + 1} | prompt: ${finalQuestion.length} chars | reply: ${text.length} chars`);
            return text;
        } catch (err) {
            lastError = err;
            const status = err?.status || err?.httpStatusCode || 'unknown';
            const msg = err?.message || 'Unknown error';
            console.error(`[GEMINI] ❌ Attempt ${attempt + 1} failed | status: ${status} | error: ${msg}`);

            // Chỉ retry nếu là lỗi tạm thời (429 rate limit, 503 server overloaded, 500 server error)
            const retryableStatuses = [429, 500, 503];
            const isRetryable = retryableStatuses.includes(status) ||
                msg.includes('429') || msg.includes('Resource has been exhausted') ||
                msg.includes('quota') || msg.includes('rate') ||
                msg.includes('overloaded') || msg.includes('503') ||
                msg.includes('RESOURCE_EXHAUSTED');

            if (!isRetryable || attempt >= MAX_RETRIES) {
                console.error(`[GEMINI] 🛑 Không retry nữa. Error detail:`, JSON.stringify({
                    message: msg,
                    status: status,
                    name: err?.name,
                    errorDetails: err?.errorDetails
                }));
                break;
            }
        }
    }

    // Trả về message thân thiện khi hết retry
    return "Dạ hiện tại hệ thống AI đang gặp chút sự cố nhỏ 😅. Bố/mẹ có thể liên hệ trực tiếp với nhà trường qua fanpage hoặc số điện thoại để được hỗ trợ nhanh nhất nhé! Cảm ơn bố mẹ rất nhiều ạ 💖";
}
