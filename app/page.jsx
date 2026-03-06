'use client';

import { useState, useRef, useEffect } from 'react';

const WELCOME_MESSAGE = {
    role: 'bot',
    content: `Chào bố mẹ! 👋\nEm là Trợ lý AI Trường mầm non Ninh Lai. Bố mẹ cần hỗ trợ thông tin gì cứ nhắn em nhé! 🏫✨`,
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
        <div className="avatar-ring bot-avatar">
            <img src="/image/avata.jpg" alt="AI Avatar" className="w-full h-full object-cover rounded-full relative z-10" />
        </div>
    );
}

function UserAvatar() {
    return (
        <div className="avatar-ring user">
            <span className="text-xl">👦</span>
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

function ChatMessage({ message, index, onReact }) {
    const isBot = message.role === 'bot';
    const hasHeart = message.reaction === 'heart';

    return (
        <div
            className={`flex items-start gap-3 animate-fade-in-up ${isBot ? '' : 'flex-row-reverse'}`}
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            {isBot ? <BotAvatar /> : <UserAvatar />}
            <div className="flex flex-col gap-1 max-w-[85%]">
                <div className={`chat-bubble ${isBot ? 'chat-bubble-bot' : 'chat-bubble-user'}`}>
                    {message.content}
                </div>
                {isBot && (
                    <div className="reaction-container">
                        <button
                            onClick={() => onReact(index, 'heart')}
                            className={`heart-btn ${hasHeart ? 'active animate-heart-pop' : ''}`}
                            title="Hữu ích"
                        >
                            {hasHeart ? '❤️' : '🤍'} {hasHeart ? 'Đã thích' : 'Hữu ích'}
                        </button>
                    </div>
                )}
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
                playAudio(WELCOME_MESSAGE.content).catch(() => { });
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
                        .filter(m => m !== WELCOME_MESSAGE) // Bỏ tin nhắn chào mừng
                        .slice(-10) // Chỉ gửi 10 tin nhắn gần nhất
                        .map(m => ({ role: m.role, content: m.content }))
                }),
            });

            if (!res.ok) {
                let errorMessage = 'Hiện tại hệ thống đang gặp sự cố. Phụ huynh vui lòng thử lại sau ạ.';
                try {
                    const errData = await res.json();
                    if (errData.reply) errorMessage = errData.reply;
                } catch { }
                throw new Error(errorMessage);
            }

            const data = await res.json();
            const rawReply = data.reply || 'Xin lỗi, em chưa thể trả lời câu hỏi này.';
            const cleanReply = rawReply.replace(/\*\*/g, '');

            const botMessage = { role: 'bot', content: cleanReply, reaction: null };
            setMessages(prev => [...prev, botMessage]);

            // Auto play TTS for the bot's response
            if (cleanReply.trim()) {
                playAudio(cleanReply).catch(() => { });
            }

        } catch (error) {
            const errorMsg = error.message || 'Hiện tại hệ thống đang gặp sự cố. Phụ huynh vui lòng thử lại sau ạ.';
            setMessages(prev => [...prev, { role: 'bot', content: errorMsg, reaction: null }]);
            playAudio(errorMsg).catch(() => { });
        } finally {
            setIsLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleReaction = (index, type) => {
        setMessages(prev => prev.map((msg, i) => {
            if (i === index) {
                return { ...msg, reaction: msg.reaction === type ? null : type };
            }
            return msg;
        }));
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

    // ====== WELCOME SCREEN ======
    if (!hasStarted) {
        return (
            <div className="flex flex-col items-center justify-center h-screen relative overflow-hidden">
                <div className="mesh-bg"></div>

                <div className="welcome-card text-center w-full max-w-sm px-8 py-10 mx-4 animate-scale-in relative z-10">
                    {/* Avatar */}
                    <div className="w-24 h-24 mx-auto rounded-[2rem] flex items-center justify-center mb-6 relative animate-float overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(56,189,248,0.08))',
                            boxShadow: '0 8px 32px rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.15)'
                        }}
                    >
                        <img src="/image/avata.jpg" alt="AI Avatar" className="w-[85%] h-[85%] object-cover rounded-full relative z-10" />
                    </div>

                    {/* Title */}
                    <h1 className="text-[28px] font-extrabold mb-2 tracking-tight"
                        style={{
                            background: 'linear-gradient(135deg, #059669, #34D399)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                        }}
                    >
                        Mầm non Ninh Lai
                    </h1>
                    <p className="text-[15px] font-semibold mb-10" style={{ color: 'var(--color-text-secondary)' }}>
                        Cùng bé khôn lớn mỗi ngày 🎈
                    </p>

                    {/* Start Button */}
                    <div className="start-btn-glow">
                        <button
                            onClick={() => setHasStarted(true)}
                            className="w-full px-8 py-[16px] rounded-2xl text-white font-bold text-[17px] hover:-translate-y-1 transition-all duration-300 relative z-10"
                            style={{
                                background: 'linear-gradient(135deg, var(--color-accent-dark), var(--color-accent))',
                                boxShadow: '0 8px 24px var(--color-accent-glow)',
                                border: '1px solid rgba(52, 211, 153, 0.3)',
                            }}
                        >
                            Bắt đầu trò chuyện ✨
                        </button>
                    </div>

                    <p className="text-xs mt-6 font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                        Trợ lý AI đáng yêu luôn sẵn sàng 24/7!
                    </p>
                </div>
            </div>
        );
    }

    // ====== CHAT SCREEN ======
    return (
        <div className="flex flex-col h-screen relative">
            <div className="mesh-bg"></div>

            {/* Header */}
            <header className="flex-shrink-0 z-20 relative">
                <div className="header-glass px-5 py-3.5 flex items-center gap-4">
                    <div className="w-11 h-11 rounded-[0.9rem] flex items-center justify-center shrink-0 overflow-hidden p-[3px]"
                        style={{
                            background: 'white',
                            border: '1px solid var(--color-border)',
                            boxShadow: 'var(--shadow-sm)',
                        }}
                    >
                        <img src="/image/avata.jpg" alt="AI Avatar" className="w-full h-full object-cover rounded-xl" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h1 className="text-[16px] font-extrabold leading-tight flex items-center gap-1.5 truncate" style={{ color: 'var(--color-text-primary)' }}>
                            Trợ lý AI Trường mầm non Ninh Lai
                            <span className="inline-flex w-3.5 h-3.5 items-center justify-center rounded-full shrink-0"
                                style={{ background: 'var(--color-accent)', boxShadow: '0 0 8px var(--color-accent-glow)' }}
                            >
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                            </span>
                        </h1>
                        <p className="text-[13px] font-bold mt-0.5 truncate" style={{ color: 'var(--color-text-muted)' }}>
                            Luôn sẵn sàng hỗ trợ 💖
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={toggleAudio}
                            className="audio-btn"
                            title={isAudioEnabled ? "Tắt âm thanh" : "Bật lại âm thanh"}
                        >
                            {isAudioEnabled ? '🔊' : '🔇'}
                        </button>
                        <div className="status-badge">
                            <span className="w-2.5 h-2.5 rounded-full animate-pulse-glow" style={{ background: 'var(--color-accent)' }}></span>
                        </div>
                    </div>
                </div>
                {/* Accent line under header */}
                <div className="header-accent-line"></div>
            </header>

            {/* Messages Area */}
            <main className="flex-1 overflow-y-auto px-4 py-6">
                <div className="chat-container space-y-6">
                    {messages.map((msg, i) => (
                        <ChatMessage key={i} message={msg} index={i} onReact={handleReaction} />
                    ))}

                    {/* Quick Questions */}
                    {showQuickQuestions && messages.length === 1 && (
                        <div className="animate-fade-in-up mt-8 max-w-2xl mx-auto" style={{ animationDelay: '0.3s' }}>
                            <p className="text-sm font-bold mb-3 text-center" style={{ color: 'var(--color-text-muted)' }}>
                                💡 Phụ huynh có thể tham khảo:
                            </p>
                            <div className="flashcard-grid">
                                {QUICK_QUESTIONS.map((q, i) => (
                                    <div
                                        key={i}
                                        onClick={() => sendMessage(q.text)}
                                        className="flashcard"
                                        style={{ animationDelay: `${0.4 + i * 0.05}s` }}
                                    >
                                        <span className="emoji">{q.emoji}</span>
                                        <span className="text">{q.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {isLoading && messages[messages.length - 1]?.role === 'user' && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                </div>
            </main>

            {/* Input Area */}
            <div className="input-dock-container">
                <div className="input-dock">
                    <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nhập tin nhắn cho trường..."
                        disabled={isLoading}
                        rows={1}
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!input.trim() || isLoading}
                        className="send-btn"
                        title="Gửi tin nhắn"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
