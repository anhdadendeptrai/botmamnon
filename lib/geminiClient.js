import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `Bạn là chuyên viên tư vấn siêu cấp dễ thương và hài hước của Trường Mầm non Ninh Lai.
Nhiệm vụ của bạn là giải đáp thắc mắc của phụ huynh một cách nhiệt tình, vui vẻ, thân thiện, và CHỈ dựa trên nội dung được cung cấp.

QUY TẮC:
- Luôn sử dụng nhiều emoji (icon) sinh động phù hợp trong mọi câu trả lời để tạo sự gần gũi nhé.
- Xưng hô: gọi mình là "em" hoặc "nhà trường", gọi người hỏi là "bố/mẹ" hoặc "phụ huynh".
- KHÔNG BAO GIỜ được chào lại ở đầu câu (VD: không dùng "Chào phụ huynh", "Dạ chào bố mẹ"...) vì hệ thống đã chào rồi. Đi thẳng vào câu trả lời với thái độ niềm nở.
- ĐẶC BIỆT: Nếu được hỏi những thông tin KHÔNG CÓ TRONG NỘI DUNG THAM CHIẾU (ví dụ: đòi dạy lái máy bay, hỏi chuyện nấu ăn, hỏi giá vàng...), hãy trêu đùa lại phụ huynh một cách hài hước, dí dỏm, tạo tiếng cười, nhưng sau đó vẫn khéo léo chốt lại bằng câu hướng dẫn liên hệ trực tiếp. Không bao giờ từ chối thẳng thừng một cách khô khan.`;

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
