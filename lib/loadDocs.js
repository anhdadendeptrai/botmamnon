import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import xlsx from 'xlsx';

let cachedDocs = null;

// Pre-compute search index for each doc at load time
function buildSearchIndex(doc) {
    const contentLower = doc.content.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    const filenameLower = doc.filename.toLowerCase();

    const words = contentLower
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);

    const wordFreq = new Map();
    for (const w of words) {
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }

    return {
        ...doc,
        _index: { contentLower, titleLower, filenameLower, wordFreq }
    };
}

async function safeProcessDocx(filePath, filename) {
    try {
        const buffer = fs.readFileSync(filePath);
        const result = await mammoth.extractRawText({ buffer });
        const title = filename.replace('.docx', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { filename, title, content: result.value.trim() };
    } catch (err) {
        console.error(`[loadDocs] Lỗi đọc .docx ${filename}:`, err.message);
        return null;
    }
}

async function safeProcessDoc(filePath, filename) {
    try {
        const WordExtractor = (await import('word-extractor')).default;
        const extractor = new WordExtractor();
        const extracted = await extractor.extract(filePath);
        const title = filename.replace('.doc', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { filename, title, content: extracted.getBody().trim() };
    } catch (err) {
        console.error(`[loadDocs] Lỗi đọc .doc ${filename}:`, err.message);
        return null;
    }
}

function safeProcessXlsx(filePath, filename) {
    try {
        const workbook = xlsx.readFile(filePath);
        let content = '';
        for (const sheetName of workbook.SheetNames) {
            const text = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
            content += `[Sheet: ${sheetName}]\n${text}\n\n`;
        }
        const title = filename.replace('.xlsx', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { filename, title, content: content.trim() };
    } catch (err) {
        console.error(`[loadDocs] Lỗi đọc .xlsx ${filename}:`, err.message);
        return null;
    }
}

export async function loadDocs() {
    if (cachedDocs) return cachedDocs;

    console.log('[loadDocs] Bắt đầu tải tài liệu...');
    const startTime = Date.now();

    const allTasks = [];

    const dirs = [
        { dir: path.join(process.cwd(), 'data', 'docs'), types: ['.docx'] },
        { dir: path.join(process.cwd(), 'public', 'huongdan'), types: ['.doc', '.docx', '.xlsx'] },
    ];

    for (const { dir, types } of dirs) {
        let dirExists = false;
        try {
            dirExists = fs.existsSync(dir);
        } catch (e) {
            console.error(`[loadDocs] Không truy cập được thư mục ${dir}:`, e.message);
            continue;
        }
        if (!dirExists) {
            console.log(`[loadDocs] Thư mục không tồn tại: ${dir}`);
            continue;
        }

        const files = fs.readdirSync(dir);
        console.log(`[loadDocs] Tìm thấy ${files.length} files trong ${dir}`);

        for (const filename of files) {
            const ext = path.extname(filename).toLowerCase();
            if (!types.includes(ext)) continue;
            const filePath = path.join(dir, filename);

            if (ext === '.docx') {
                allTasks.push(safeProcessDocx(filePath, filename));
            } else if (ext === '.doc') {
                allTasks.push(safeProcessDoc(filePath, filename));
            } else if (ext === '.xlsx') {
                allTasks.push(Promise.resolve(safeProcessXlsx(filePath, filename)));
            }
        }
    }

    console.log(`[loadDocs] Đang xử lý ${allTasks.length} files song song...`);
    const results = await Promise.all(allTasks);
    const docs = results.filter(Boolean).map(buildSearchIndex);

    cachedDocs = docs;
    console.log(`[loadDocs] ✅ Hoàn tất: ${docs.length} tài liệu trong ${Date.now() - startTime}ms`);
    return cachedDocs;
}
