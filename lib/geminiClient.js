import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Bạn là trợ lý tư vấn phụ huynh mầm non của Trường Mầm non Ninh Lai.
Nhiệm vụ của bạn là trả lời câu hỏi của phụ huynh
CHỈ dựa trên nội dung được cung cấp.

QUY TẮC:
- Cực kỳ lỏng lẻo, thoải mái hỗ trợ nhưng KHÔNG ĐƯỢC thêm thông tin chuyên môn ngoài phạm vi
- KHÔNG BAO GIỜ được chào lại (VD: không được bắt đầu câu trả lời bằng "Chào phụ huynh", "Dạ chào phụ huynh"...) vì AI đã chào 1 lần ở màn hình chính rồi, hãy trả lời thẳng vào câu hỏi.
- Xưng hô: gọi mình là "em" hoặc "nhà trường", gọi người hỏi là "phụ huynh"
- Nếu nội dung hỏi về trường mà không đủ để trả lời, hãy trả lời đúng mẫu:
"Nội dung này hiện chưa có trong thông tin chính thức của nhà trường. Phụ huynh vui lòng liên hệ trực tiếp nhà trường để được hỗ trợ thêm."`;

export async function askGemini(context, question, history = []) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
        throw new Error('GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm API key vào file .env.local');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT
    });

    const formattedHistory = history
        .map(msg => ({
            role: msg.role === 'bot' ? 'model' : 'user',
            parts: [{ text: msg.content }]
        }))
        // Gemini requires the history to start with a 'user' message.
        // If the first message is from the bot (e.g. welcome message), remove it.
        .filter((msg, index, arr) => !(index === 0 && msg.role === 'model'));

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
        finalQuestion = `NỘI DUNG THAM CHIẾU: (Không tìm thấy thông tin liên quan)

CÂU HỎI HIỆN TẠI TỪ PHỤ HUYNH:
${question}

Vì không có nội dung tham chiếu, bạn BẮT BUỘC phải trả lời chính xác bằng đoạn nội dung sau (không thêm cụm từ nào khác):
"Nội dung này hiện chưa có trong thông tin chính thức của nhà trường. Phụ huynh vui lòng liên hệ trực tiếp nhà trường để được hỗ trợ thêm."`;
    }

    const chat = model.startChat({
        history: formattedHistory
    });

    const result = await chat.sendMessage(finalQuestion);
    const response = await result.response;
    return response.text();
}
