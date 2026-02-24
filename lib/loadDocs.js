import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import xlsx from 'xlsx';

let cachedDocs = null;

export async function loadDocs() {
    if (cachedDocs) return cachedDocs;

    const docs = [];

    // 1. Load .docx from data/docs
    const docsDir = path.join(process.cwd(), 'data', 'docs');
    if (fs.existsSync(docsDir)) {
        const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.docx'));
        const docxDocs = await Promise.all(
            files.map(async (filename) => {
                const filePath = path.join(docsDir, filename);
                const buffer = fs.readFileSync(filePath);
                try {
                    const result = await mammoth.extractRawText({ buffer });
                    const title = filename.replace('.docx', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return { filename, title, content: result.value.trim() };
                } catch (err) {
                    console.error(`Lỗi đọc file ${filename}:`, err);
                    return null;
                }
            })
        );
        docs.push(...docxDocs.filter(Boolean));
    }

    // 2. Load .doc and .docx from public/huongdan
    const huongDanDir = path.join(process.cwd(), 'public', 'huongdan');
    if (fs.existsSync(huongDanDir)) {
        const extractor = new WordExtractor();

        // Process .doc files
        const docFiles = fs.readdirSync(huongDanDir).filter(f => f.endsWith('.doc'));
        const docDocs = await Promise.all(
            docFiles.map(async (filename) => {
                const filePath = path.join(huongDanDir, filename);
                try {
                    const extracted = await extractor.extract(filePath);
                    const title = filename.replace('.doc', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return { filename, title, content: extracted.getBody().trim() };
                } catch (err) {
                    console.error(`Lỗi đọc file ${filename}:`, err);
                    return null;
                }
            })
        );
        docs.push(...docDocs.filter(Boolean));

        // Process .docx files
        const docxFiles = fs.readdirSync(huongDanDir).filter(f => f.endsWith('.docx'));
        const docxDocsHuongDan = await Promise.all(
            docxFiles.map(async (filename) => {
                const filePath = path.join(huongDanDir, filename);
                const buffer = fs.readFileSync(filePath);
                try {
                    const result = await mammoth.extractRawText({ buffer });
                    const title = filename.replace('.docx', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return { filename, title, content: result.value.trim() };
                } catch (err) {
                    console.error(`Lỗi đọc file ${filename}:`, err);
                    return null;
                }
            })
        );
        docs.push(...docxDocsHuongDan.filter(Boolean));

        // Process .xlsx files
        const xlsxFiles = fs.readdirSync(huongDanDir).filter(f => f.endsWith('.xlsx'));
        const xlsxDocsHuongDan = await Promise.all(
            xlsxFiles.map(async (filename) => {
                const filePath = path.join(huongDanDir, filename);
                try {
                    const workbook = xlsx.readFile(filePath);
                    let content = '';
                    workbook.SheetNames.forEach(sheetName => {
                        const sheet = workbook.Sheets[sheetName];
                        const text = xlsx.utils.sheet_to_csv(sheet);
                        content += `[Sheet: ${sheetName}]\n${text}\n\n`;
                    });
                    const title = filename.replace('.xlsx', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                    return { filename, title, content: content.trim() };
                } catch (err) {
                    console.error(`Lỗi đọc file ${filename}:`, err);
                    return null;
                }
            })
        );
        docs.push(...xlsxDocsHuongDan.filter(Boolean));
    }

    cachedDocs = docs;
    console.log(`Đã tải ${cachedDocs.length} tài liệu vào bộ nhớ`);
    return cachedDocs;
}
