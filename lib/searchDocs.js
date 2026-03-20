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

// Giới hạn tổng context gửi cho AI (ký tự)
const MAX_CONTEXT_CHARS = 4000;

// Kích thước mỗi chunk (ký tự)
const CHUNK_SIZE = 500;
// Số ký tự overlap giữa các chunk
const CHUNK_OVERLAP = 50;

// Bỏ dấu tiếng Việt để so sánh filename/title
function removeDiacritics(str) {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

// Mở rộng từ khoá: nếu hỏi "ăn gì" thì cũng tìm "thực đơn", "bữa chính"...
const QUERY_EXPANSION = {
    'ăn': ['thực', 'đơn', 'bữa', 'chính', 'phụ', 'thực đơn'],
    'menu': ['thực', 'đơn', 'bữa', 'thực đơn'],
    'bữa': ['thực', 'đơn', 'ăn', 'chính', 'phụ'],
};

function tokenize(text) {
    return text
        .toLowerCase()
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}

// Mở rộng tokens với từ đồng nghĩa
function expandTokens(tokens) {
    const expanded = new Set(tokens);
    for (const token of tokens) {
        const extra = QUERY_EXPANSION[token];
        if (extra) {
            for (const e of extra) expanded.add(e);
        }
    }
    return [...expanded];
}

/**
 * Chia nội dung document thành các chunk nhỏ, mỗi chunk ~CHUNK_SIZE ký tự.
 * Cắt tại ranh giới dòng/câu để không bị bể nội dung.
 */
function splitIntoChunks(text) {
    if (text.length <= CHUNK_SIZE) {
        return [text];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
        let end = Math.min(start + CHUNK_SIZE, text.length);

        // Cố gắng cắt tại ranh giới dòng hoặc dấu chấm câu
        if (end < text.length) {
            const lastNewline = text.lastIndexOf('\n', end);
            const lastPeriod = text.lastIndexOf('. ', end);
            const breakPoint = Math.max(lastNewline, lastPeriod);
            if (breakPoint > start + CHUNK_SIZE * 0.3) {
                end = breakPoint + 1;
            }
        }

        const chunk = text.slice(start, end).trim();
        if (chunk.length > 0) {
            chunks.push(chunk);
        }

        // Tính vị trí bắt đầu tiếp theo với overlap
        const nextStart = end - CHUNK_OVERLAP;
        // Đảm bảo start luôn tiến về phía trước để tránh loop vô hạn
        start = Math.max(nextStart, start + 1);

        if (start >= text.length) break;
    }

    return chunks;
}

/**
 * Tính điểm liên quan cho một chunk nhỏ.
 */
function scoreChunk(chunkText, queryTokens, questionLower) {
    const chunkLower = chunkText.toLowerCase();
    let score = 0;

    for (const token of queryTokens) {
        // Đếm số lần token xuất hiện trong chunk
        let idx = 0;
        let count = 0;
        while ((idx = chunkLower.indexOf(token, idx)) !== -1) {
            count++;
            idx += token.length;
        }
        if (count > 0) score += count;
    }

    // Bonus cho exact phrase match
    if (chunkLower.includes(questionLower)) score += 15;

    return score;
}

export function searchDocs(question, docs) {
    if (!docs || docs.length === 0) return '';

    const rawTokens = tokenize(question);

    // Nếu không tokenize được (chào hỏi, etc.), trả về tóm tắt ngắn
    if (rawTokens.length === 0) {
        return '';
    }

    // Mở rộng tokens (ăn → thực đơn, bữa chính...)
    const queryTokens = expandTokens(rawTokens);

    const questionLower = question.toLowerCase();

    // ===== Bước 1: Tìm doc liên quan =====
    const scoredDocs = docs.map(doc => {
        const { contentLower, titleLower, filenameLower, wordFreq } = doc._index;
        let score = 0;

        // So sánh bỏ dấu cho filename/title
        const fileNorm = removeDiacritics(filenameLower);
        const titleNorm = removeDiacritics(titleLower);

        for (const token of queryTokens) {
            const tokenNorm = removeDiacritics(token);
            // Match có dấu
            if (titleLower.includes(token)) score += 10;
            if (filenameLower.includes(token)) score += 10;
            // Match bỏ dấu (VD: "thực đơn" → "thucdon" trong filename)
            if (fileNorm.includes(tokenNorm)) score += 8;
            if (titleNorm.includes(tokenNorm)) score += 8;
            const freq = wordFreq.get(token);
            if (freq) score += Math.min(freq, 5); // Cap freq để doc dài không chiếm ưu thế
        }

        if (contentLower.includes(questionLower)) score += 20;
        return { doc, score };
    });

    scoredDocs.sort((a, b) => b.score - a.score);

    // Chỉ lấy docs có score > 0 (tối đa 3 docs)
    const relevantDocs = scoredDocs.filter(s => s.score > 0).slice(0, 3);
    if (relevantDocs.length === 0) return '';

    // ===== Bước 2: Chunk-level search trong các doc liên quan =====
    const allChunks = [];

    for (const { doc } of relevantDocs) {
        const chunks = splitIntoChunks(doc.content);
        for (const chunkText of chunks) {
            const chunkScore = scoreChunk(chunkText, queryTokens, questionLower);
            if (chunkScore > 0) {
                allChunks.push({
                    title: doc.title,
                    text: chunkText,
                    score: chunkScore,
                });
            }
        }
    }

    // Sắp xếp chunk theo điểm, lấy chunks tốt nhất
    allChunks.sort((a, b) => b.score - a.score);

    // ===== Bước 3: Ghép chunks, giới hạn MAX_CONTEXT_CHARS =====
    const selectedChunks = [];
    let totalChars = 0;

    for (const chunk of allChunks) {
        const entry = `[${chunk.title}]\n${chunk.text}`;
        if (totalChars + entry.length > MAX_CONTEXT_CHARS) {
            // Nếu chưa có chunk nào, cắt bớt chunk đầu tiên
            if (selectedChunks.length === 0) {
                selectedChunks.push(entry.slice(0, MAX_CONTEXT_CHARS));
                totalChars = MAX_CONTEXT_CHARS;
            }
            break;
        }
        selectedChunks.push(entry);
        totalChars += entry.length;
    }

    if (selectedChunks.length === 0) return '';

    return selectedChunks.join('\n\n---\n\n');
}
