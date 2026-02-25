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

    if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === 'user') {
        validHistory.pop();
    }
    // Log tóm tắt
    if (validHistory.length > 0) console.log('[GEMINI] History:', validHistory.length, 'entries');

    let finalQuestion;

    if (context && context.trim().length > 0) {
        finalQuestion = `TÀI LIỆU:
${context}

CÂU HỎI: ${question}`;
    } else {
        finalQuestion = question;
    }

    try {
        const chat = model.startChat({ history: validHistory });
        const startTime = Date.now();
        const result = await chat.sendMessage(finalQuestion);
        const response = await result.response;
        const text = response.text();
        console.log(`[GEMINI] ✅ ${Date.now() - startTime}ms | prompt: ${finalQuestion.length} chars | reply: ${text.length} chars`);
        return text;
    } catch (err) {
        console.error('[GEMINI] ❌ Error:', err?.message, '| status:', err?.status);
        return "Dạ hiện tại hệ thống AI đang gặp chút sự cố nhỏ 😅. Bố/mẹ có thể liên hệ trực tiếp với nhà trường qua fanpage hoặc số điện thoại để được hỗ trợ nhanh nhất nhé! Cảm ơn bố mẹ rất nhiều ạ 💖";
    }
}
