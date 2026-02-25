import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Bạn là Trợ lý AI Trường mầm non Ninh Lai.
Hỗ trợ phụ huynh giải đáp thắc mắc nhanh chóng, chính xác và thân thiện dựa trên nội dung được cung cấp.

THÔNG TIN CHUNG:
- Địa chỉ: thôn Hội Tân, xã Sơn Thuỷ, tỉnh Tuyên Quang
- Số điện thoại liên hệ: 0373194186

QUY TẮC QUAN TRỌNG NHẤT:
- CHỈ ĐƯỢC trả lời dựa trên NỘI DUNG THAM CHIẾU được cung cấp trong từng câu hỏi. Đây là nguồn thông tin DUY NHẤT của bạn.
- TUYỆT ĐỐI KHÔNG được bịa đặt, suy đoán, hay tự lấy thông tin từ bên ngoài (hallucination). Nếu thông tin không có trong tài liệu tham chiếu thì KHÔNG ĐƯỢC trả lời như thể bạn biết.
- Nếu câu hỏi KHÔNG có thông tin trong tài liệu: Thông báo thân thiện rằng thông tin này em chưa được nhà trường cung cấp, và hướng dẫn phụ huynh liên hệ trực tiếp nhà trường qua số điện thoại 0373194186.

QUY TẮC KHÁC:
- Trả lời ngắn gọn, đi thẳng vào vấn đề.
- Sử dụng emoji phù hợp để tạo sự gần gũi.
- Xưng hô: "em" hoặc "nhà trường" - "bố/mẹ" hoặc "phụ huynh".
- Không chào lại ở đầu câu.
- Khi hướng dẫn liên hệ, tuyệt đối không được nêu đích danh tên của giáo viên, hiệu trưởng hay hiệu phó.`;

export async function askGemini(context, question, history = []) {
    console.log('\n========== [GEMINI DEBUG] START ==========');
    console.log('[GEMINI DEBUG] Question:', question);
    console.log('[GEMINI DEBUG] Context length:', context?.length || 0);
    console.log('[GEMINI DEBUG] History length:', history?.length || 0);

    const apiKey = process.env.GEMINI_API_KEY;
    console.log('[GEMINI DEBUG] API Key exists:', !!apiKey);
    console.log('[GEMINI DEBUG] API Key prefix:', apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING');

    if (!apiKey || apiKey === 'your_api_key_here') {
        console.error('[GEMINI DEBUG] ❌ API Key not configured!');
        throw new Error('GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm API key vào file .env.local');
    }

    console.log('[GEMINI DEBUG] Creating GoogleGenerativeAI instance...');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.0-flash',
        systemInstruction: SYSTEM_PROMPT
    });
    console.log('[GEMINI DEBUG] ✅ Model initialized: gemini-2.0-flash');

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
    console.log('[GEMINI DEBUG] Valid history entries:', validHistory.length);
    console.log('[GEMINI DEBUG] History roles:', validHistory.map(h => h.role).join(' → '));

    let finalQuestion;

    if (context && context.trim().length > 0) {
        finalQuestion = `NỘI DUNG THAM CHIẾU TỪ NHÀ TRƯỜNG:
<<<
${context}
>>>

CÂU HỎI HIỆN TẠI TỪ PHỤ HUYNH:
${question}

Hãy dựa vào NỘI DUNG THAM CHIẾU trên để trả lời câu hỏi hiện tại.`;
    } else {
        finalQuestion = `NỘI DUNG THAM CHIẾU: (Không tìm thấy thông tin liên quan trong tài liệu nhà trường)

CÂU HỎI HIỆN TẠI TỪ PHỤ HUYNH:
${question}

Nếu đây chỉ là câu chào hỏi (ví dụ: xin chào, alo, hi...), cảm ơn, hoặc tạm biệt thông thường: Hãy đáp lại một cách thân thiện, đáng yêu và tự nhiên nhất.
Nếu đây là một câu hỏi thực sự nhưng KHÔNG có trong tài liệu nhà trường: KHÔNG ĐƯỢC bịa đặt hay tự suy đoán câu trả lời. Hãy thông báo thân thiện rằng thông tin này em chưa được nhà trường cung cấp, và hướng dẫn phụ huynh liên hệ trực tiếp qua số điện thoại 0373194186 để được hỗ trợ.`;
    }

    try {
        console.log('[GEMINI DEBUG] Starting chat with', validHistory.length, 'history entries...');
        const chat = model.startChat({
            history: validHistory
        });

        console.log('[GEMINI DEBUG] Sending message to Gemini... (question length:', finalQuestion.length, 'chars)');
        const startTime = Date.now();
        const result = await chat.sendMessage(finalQuestion);
        const response = await result.response;
        const text = response.text();
        const elapsed = Date.now() - startTime;
        console.log('[GEMINI DEBUG] ✅ Response received in', elapsed, 'ms');
        console.log('[GEMINI DEBUG] Response length:', text.length, 'chars');
        console.log('[GEMINI DEBUG] Response preview:', text.substring(0, 100) + '...');
        console.log('========== [GEMINI DEBUG] END ==========\n');
        return text;
    } catch (err) {
        console.error('\n========== [GEMINI DEBUG] ❌ ERROR ==========');
        console.error('[GEMINI DEBUG] Error name:', err?.name);
        console.error('[GEMINI DEBUG] Error message:', err?.message);
        console.error('[GEMINI DEBUG] Error status:', err?.status);
        console.error('[GEMINI DEBUG] Error statusText:', err?.statusText);
        console.error('[GEMINI DEBUG] Error details:', JSON.stringify(err, null, 2));
        console.error('[GEMINI DEBUG] Error stack:', err?.stack);
        console.error('========== [GEMINI DEBUG] END ERROR ==========\n');
        return "Dạ hiện tại hệ thống AI đang gặp chút sự cố nhỏ 😅. Bố/mẹ có thể liên hệ trực tiếp với nhà trường qua fanpage hoặc số điện thoại để được hỗ trợ nhanh nhất nhé! Cảm ơn bố mẹ rất nhiều ạ 💖";
    }
}
