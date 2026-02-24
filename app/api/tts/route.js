import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { text } = await request.json();

        if (!text || typeof text !== 'string') {
            return NextResponse.json({ error: 'Thiếu nội dung văn bản' }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_TTS_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: 'Thiếu cấu hình GOOGLE_TTS_API_KEY trong file .env.local' },
                { status: 500 }
            );
        }

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

        // Clean text: remove emojis and markdown for better speech
        let cleanText = text
            .replace(/<[^>]*>?/gm, '')
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
            .replace(/[\u{1F700}-\u{1F77F}]/gu, '')
            .replace(/[\u{1F780}-\u{1F7FF}]/gu, '')
            .replace(/[\u{1F800}-\u{1F8FF}]/gu, '')
            .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
            .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '')
            .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '')
            .replace(/[\u{2600}-\u{26FF}]/gu, '')
            .replace(/[\u{2700}-\u{27BF}]/gu, '')
            .replace(/\*/g, '')
            .replace(/#/g, '')
            .replace(/- /g, '')
            .trim();

        if (!cleanText) {
            return NextResponse.json({ error: 'Không có văn bản hợp lệ để đọc' }, { status: 400 });
        }

        const requestBody = {
            input: { text: cleanText },
            voice: { languageCode: 'vi-VN', name: 'vi-VN-Neural2-A' }, // Premium Vietnamese female voice
            audioConfig: { audioEncoding: 'MP3' },
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error('Google Cloud TTS API Error:', errData);
            throw new Error(errData.error?.message || 'Có lỗi xảy ra khi gọi Google TTS API');
        }

        const data = await response.json();
        return NextResponse.json({ audioContent: data.audioContent });

    } catch (error) {
        console.error('TTS API Route Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
