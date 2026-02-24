const STOP_WORDS = new Set([
    'là', 'và', 'của', 'có', 'cho', 'này', 'với', 'các', 'được', 'trong',
    'không', 'những', 'một', 'đã', 'để', 'từ', 'theo', 'về', 'khi', 'đến',
    'như', 'hay', 'hoặc', 'nhưng', 'vì', 'nếu', 'thì', 'mà', 'do', 'bị',
    'ở', 'ra', 'lên', 'xuống', 'vào', 'tôi', 'em', 'anh', 'chị', 'ạ',
    'nhé', 'nha', 'rồi', 'rất', 'lắm', 'quá', 'hơn', 'nhất', 'cũng',
    'sẽ', 'đang', 'vẫn', 'còn', 'bao', 'giờ', 'nào', 'gì', 'ai', 'đâu',
    'sao', 'thế', 'nào', 'bao nhiêu', 'mấy', 'xin', 'hỏi', 'cho',
    'biết', 'muốn', 'cần', 'phải', 'nên', 'thể', 'được', 'bạn', 'tớ',
]);

function tokenize(text) {
    return text
        .toLowerCase()
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

export function searchDocs(question, docs) {
    if (!docs || docs.length === 0) return '';

    const queryTokens = tokenize(question);

    if (queryTokens.length === 0) {
        return docs.map(d => `--- ${d.title} ---\n${d.content}`).join('\n\n');
    }

    const scored = docs.map(doc => {
        const contentLower = doc.content.toLowerCase();
        const titleLower = doc.title.toLowerCase();
        const filenameLower = doc.filename.toLowerCase();

        let score = 0;

        for (const token of queryTokens) {
            // Title match (high weight)
            if (titleLower.includes(token)) score += 10;
            // Filename match (high weight)
            if (filenameLower.includes(token)) score += 10;
            // Content match — count occurrences
            const regex = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            const matches = contentLower.match(regex);
            if (matches) score += matches.length;
        }

        // Bonus for exact phrase match
        const questionLower = question.toLowerCase();
        if (contentLower.includes(questionLower)) score += 20;

        return { doc, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Return top docs with score > 0 (max 2)
    const relevant = scored.filter(s => s.score > 0).slice(0, 2);

    if (relevant.length === 0) return '';

    return relevant
        .map(s => `--- ${s.doc.title} ---\n${s.doc.content}`)
        .join('\n\n');
}
