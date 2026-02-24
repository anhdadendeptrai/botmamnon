import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import xlsx from 'xlsx';

let cachedDocs = null;
let loadPromise = null;

// Pre-compute search index for each doc at load time
function buildSearchIndex(doc) {
    const contentLower = doc.content.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    const filenameLower = doc.filename.toLowerCase();

    // Pre-tokenize content for fast lookup
    const words = contentLower
        .normalize('NFC')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1);

    // Build word frequency map for O(1) count lookups
    const wordFreq = new Map();
    for (const w of words) {
        wordFreq.set(w, (wordFreq.get(w) || 0) + 1);
    }

    return {
        ...doc,
        _index: { contentLower, titleLower, filenameLower, wordFreq }
    };
}

async function processDocx(filePath, filename) {
    const buffer = fs.readFileSync(filePath);
    try {
        const result = await mammoth.extractRawText({ buffer });
        const title = filename.replace('.docx', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { filename, title, content: result.value.trim() };
    } catch (err) {
        console.error(`Lỗi đọc file ${filename}:`, err.message);
        return null;
    }
}

async function processDoc(extractor, filePath, filename) {
    try {
        const extracted = await extractor.extract(filePath);
        const title = filename.replace('.doc', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return { filename, title, content: extracted.getBody().trim() };
    } catch (err) {
        console.error(`Lỗi đọc file ${filename}:`, err.message);
        return null;
    }
}

function processXlsx(filePath, filename) {
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
        console.error(`Lỗi đọc file ${filename}:`, err.message);
        return null;
    }
}

async function doLoadDocs() {
    const allTasks = [];
    const extractor = new WordExtractor();

    // Collect all files from both directories
    const dirs = [
        { dir: path.join(process.cwd(), 'data', 'docs'), types: ['.docx'] },
        { dir: path.join(process.cwd(), 'public', 'huongdan'), types: ['.doc', '.docx', '.xlsx'] },
    ];

    for (const { dir, types } of dirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir);
        for (const filename of files) {
            const ext = path.extname(filename).toLowerCase();
            if (!types.includes(ext)) continue;
            const filePath = path.join(dir, filename);

            // Push all as parallel promises
            if (ext === '.docx') {
                allTasks.push(processDocx(filePath, filename));
            } else if (ext === '.doc') {
                allTasks.push(processDoc(extractor, filePath, filename));
            } else if (ext === '.xlsx') {
                allTasks.push(Promise.resolve(processXlsx(filePath, filename)));
            }
        }
    }

    // Load ALL files in parallel
    const results = await Promise.all(allTasks);
    const docs = results.filter(Boolean).map(buildSearchIndex);

    console.log(`✅ Đã tải ${docs.length} tài liệu vào bộ nhớ (có index)`);
    return docs;
}

export async function loadDocs() {
    if (cachedDocs) return cachedDocs;

    // Prevent duplicate loading if called concurrently
    if (!loadPromise) {
        loadPromise = doLoadDocs().then(docs => {
            cachedDocs = docs;
            loadPromise = null;
            return docs;
        }).catch(err => {
            loadPromise = null;
            throw err;
        });
    }

    return loadPromise;
}

// Eagerly start loading at module import time (don't await)
loadPromise = doLoadDocs().then(docs => {
    cachedDocs = docs;
    loadPromise = null;
}).catch(err => {
    console.error('Eager load failed:', err.message);
    loadPromise = null;
});
