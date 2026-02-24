import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Bạn là Trợ lý AI Trường mầm non Ninh Lai.
Hỗ trợ phụ huynh giải đáp thắc mắc nhanh chóng, chính xác và thân thiện dựa trên nội dung được cung cấp.

QUY TẮC:
- Trả lời ngắn gọn, đi thẳng vào vấn đề.
- Sử dụng emoji phù hợp để tạo sự gần gũi.
- Xưng hô: "em" hoặc "nhà trường" - "bố/mẹ" hoặc "phụ huynh".
- Không chào lại ở đầu câu.
- Nếu không có thông tin trong tài liệu: Phản hồi khéo léo, ngắn gọn và hướng dẫn phụ huynh liên hệ trực tiếp nhà trường qua hotline/fanpage.`;

export async function askGemini(context, question, history = []) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'your_api_key_here') {
        throw new Error('GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm API key vào file .env.local');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
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
        finalQuestion = `NỘI DUNG THAM CHIẾU: (Không tìm thấy thông tin liên quan hoặc câu hỏi nằm ngoài ngữ cảnh)

CÂU HỎI HIỆN TẠI TỪ PHỤ HUYNH:
${question}

Vì không có thông tin tham chiếu, hãy nghĩ ra một câu trả lời thật hài hước, trêu đùa phụ huynh để tạo tiếng cười. Dùng nhiều emoji vào nhé! 
Sau khi trêu đùa xong, CẦN LUÔN CHỐT LẠI ý này một cách tự nhiên: "Tuy nhiên, thông tin này em chưa được nhà trường cung cấp. Bố mẹ vui lòng liên hệ trực tiếp qua số điện thoại hoặc fanpage của trường để được hỗ trợ thêm nha!"`;
    }

    const chat = model.startChat({
        history: formattedHistory
    });

    const result = await chat.sendMessage(finalQuestion);
    const response = await result.response;
    return response.text();
}
