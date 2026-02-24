'use client';

import { useState, useRef, useEffect } from 'react';

const WELCOME_MESSAGE = {
    role: 'bot',
    content: `Chào bố mẹ! 🥰\nEm là Trợ lý AI siêu cấp đáng yêu của Trường Mầm non Ninh Lai đây ạ. 🏫✨\nBố mẹ muốn hỏi thông tin gì cứ nhắn cho em nha! 👇`,
};

const QUICK_QUESTIONS = [
    { emoji: '🏫', text: 'Giới thiệu về trường' },
    { emoji: '📋', text: 'Hồ sơ nhập học cần gì?' },
    { emoji: '🕐', text: 'Giờ đón trả trẻ' },
    { emoji: '🍱', text: 'Thực đơn bán trú' },
    { emoji: '📞', text: 'Địa chỉ liên hệ' },
    { emoji: '📖', text: 'Quy định nhà trường' },
];

function BotAvatar() {
    return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm z-10"
            style={{ background: 'linear-gradient(135deg, var(--color-white), var(--color-mint-light))', border: '2px solid white' }}>
            🌸
        </div>
    );
}

function UserAvatar() {
    return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-sm z-10"
            style={{ background: 'linear-gradient(135deg, var(--color-peach), var(--color-coral))', border: '2px solid white' }}>
            👦
        </div>
    );
}

function TypingIndicator() {
    return (
        <div className="flex items-start gap-3 animate-fade-in-up">
            <BotAvatar />
            <div className="chat-bubble chat-bubble-bot flex items-center gap-1.5 py-4 px-5">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
            </div>
        </div>
    );
}

function ChatMessage({ message, index }) {
    const isBot = message.role === 'bot';

    return (
        <div
            className={`flex items-start gap-3 animate-fade-in-up ${isBot ? '' : 'flex-row-reverse'}`}
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            {isBot ? <BotAvatar /> : <UserAvatar />}
            <div className={`chat-bubble ${isBot ? 'chat-bubble-bot' : 'chat-bubble-user'}`}>
                {message.content}
            </div>
        </div>
    );
}

export default function Home() {
    const [hasStarted, setHasStarted] = useState(false);
    const [messages, setMessages] = useState([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showQuickQuestions, setShowQuickQuestions] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const audioRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        if (hasStarted) {
            scrollToBottom();
        }
    }, [messages, isLoading, hasStarted]);

    const playAudio = async (text) => {
        if (!isAudioEnabled) return;

        try {
            const res = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text }),
            });
            const data = await res.json();
            if (data.audioContent) {
                const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);

                if (audioRef.current) {
                    audioRef.current.pause();
                }
                audioRef.current = audio;
                await audio.play();
            }
        } catch (error) {
            console.error('Audio play error:', error);
        }
    };

    // Auto-play the welcome message when user clicks Start
    useEffect(() => {
        if (hasStarted && isAudioEnabled) {
            const playWelcome = setTimeout(() => {
                playAudio(WELCOME_MESSAGE.content);
            }, 300);
            return () => clearTimeout(playWelcome);
        }
    }, [hasStarted]); // Run when hasStarted becomes true

    const sendMessage = async (text) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading) return;

        setShowQuickQuestions(false);
        setInput('');

        const userMessage = { role: 'user', content: trimmed };
        const currentHistory = [...messages];

        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: trimmed,
                    history: currentHistory
                }),
            });

            const data = await res.json();
            const replyText = data.reply || 'Xin lỗi, em chưa thể trả lời câu hỏi này.';
            const botMessage = { role: 'bot', content: replyText };

            setMessages(prev => [...prev, botMessage]);

            // Auto play TTS for the bot's response
            playAudio(replyText);

        } catch (error) {
            const errorMsg = 'Hiện tại hệ thống đang gặp sự cố. Phụ huynh vui lòng thử lại sau ạ.';
            setMessages(prev => [...prev, { role: 'bot', content: errorMsg }]);
            playAudio(errorMsg);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(input);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    const toggleAudio = () => {
        setIsAudioEnabled(!isAudioEnabled);
        if (isAudioEnabled && audioRef.current) {
            audioRef.current.pause();
        }
    };

    if (!hasStarted) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-transparent relative overflow-hidden">
                <div className="absolute inset-0 z-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_50%_50%,_white_0%,_transparent_100%)]"></div>
                <div className="text-center animate-fade-in-up max-w-sm px-6 relative z-10">
                    <div className="w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center text-5xl mb-8 border-[5px] border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] transition-transform hover:scale-105"
                        style={{ background: 'linear-gradient(135deg, var(--color-white), var(--color-mint-light))' }}>
                        🏫
                    </div>
                    <h1 className="text-[28px] font-extrabold mb-2 tracking-tight" style={{ color: 'var(--color-text)' }}>
                        Mầm non Ninh Lai
                    </h1>
                    <p className="text-[15px] font-semibold mb-10 opacity-70" style={{ color: 'var(--color-text-light)' }}>
                        Cùng bé khôn lớn mỗi ngày 🎈
                    </p>
                    <button
                        onClick={() => setHasStarted(true)}
                        className="w-full px-8 py-[18px] rounded-2xl text-white font-bold text-[17px] shadow-[0_8px_20px_rgba(34,197,94,0.3)] hover:shadow-[0_12px_24px_rgba(34,197,94,0.4)] hover:-translate-y-1 transition-all duration-300"
                        style={{ background: 'linear-gradient(135deg, var(--color-mint-dark), var(--color-mint))' }}
                    >
                        Bắt đầu trò chuyện ✨
                    </button>
                    <p className="text-xs mt-6 font-semibold opacity-50" style={{ color: 'var(--color-text-light)' }}>
                        Trợ lý AI đáng yêu luôn sẵn sàng 24/7!
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen" style={{ background: 'var(--color-cream)' }}>
            {/* Header */}
            <header className="header-gradient px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.03)] flex items-center gap-3 flex-shrink-0 z-20 relative">
                <div className="w-12 h-12 rounded-[1rem] flex items-center justify-center text-[26px] shadow-sm bg-white/40 backdrop-blur-md border border-white/50">
                    🏫
                </div>
                <div>
                    <h1 className="text-[17px] font-extrabold text-[#1F2937] leading-tight flex items-center gap-1.5">
                        Trợ lý Ninh Lai
                        <span className="inline-flex w-4 h-4 items-center justify-center bg-[#22C55E] rounded-full">
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                        </span>
                    </h1>
                    <p className="text-[13px] font-bold text-[#6B7280] opacity-90 mt-0.5">
                        Luôn sẵn sàng hỗ trợ 💖
                    </p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    <button
                        onClick={toggleAudio}
                        className="audio-btn p-2 rounded-full text-white flex items-center justify-center"
                        title={isAudioEnabled ? "Tắt âm thanh" : "Bật lại âm thanh"}
                    >
                        {isAudioEnabled ? '🔊' : '🔇'}
                    </button>
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-green-300 animate-pulse shadow-[0_0_8px_rgba(134,239,172,0.8)]"></span>
                    </div>
                </div>
            </header>

            {/* Messages Area */}
            <main className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
                {messages.map((msg, i) => (
                    <ChatMessage key={i} message={msg} index={i} />
                ))}

                {/* Quick Questions */}
                {showQuickQuestions && messages.length === 1 && (
                    <div className="animate-fade-in-up mt-6" style={{ animationDelay: '0.3s' }}>
                        <p className="text-sm font-semibold mb-3 pl-2" style={{ color: 'var(--color-text-light)' }}>
                            💡 Phụ huynh có thể tham khảo:
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            {QUICK_QUESTIONS.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(q.text)}
                                    className="quick-btn rounded-2xl px-4 py-3.5 text-left text-sm font-medium flex items-center gap-3"
                                    style={{ color: 'var(--color-text)', animationDelay: `${0.4 + i * 0.05}s` }}
                                >
                                    <span className="text-xl drop-shadow-sm">{q.emoji}</span>
                                    <span className="leading-snug">{q.text}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {isLoading && <TypingIndicator />}
                <div ref={messagesEndRef} />
            </main>

            {/* Input Area */}
            <div className="input-area px-4 py-4 flex-shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
                <form onSubmit={handleSubmit} className="flex items-end gap-2.5 max-w-3xl mx-auto">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Phụ huynh nhập câu hỏi tại đây..."
                            disabled={isLoading}
                            rows={1}
                            className="w-full resize-none rounded-2xl px-5 py-3.5 text-[15px] border-2 focus:outline-none transition-all duration-300"
                            style={{
                                borderColor: 'var(--color-mint-light)',
                                background: 'var(--color-white)',
                                color: 'var(--color-text)',
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = 'var(--color-mint-dark)';
                                e.target.style.boxShadow = '0 4px 12px rgba(168, 216, 200, 0.15)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = 'var(--color-mint-light)';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="send-btn rounded-2xl p-3.5 text-white flex-shrink-0"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </form>
                <p className="text-center text-[11px] mt-2.5 font-medium opacity-70" style={{ color: 'var(--color-text-light)' }}>
                    Thông tin được trích xuất từ tài liệu chính thức của Trường Mầm non Ninh Lai
                </p>
            </div>
        </div>
    );
}
