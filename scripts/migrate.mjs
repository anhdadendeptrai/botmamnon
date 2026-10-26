#!/usr/bin/env node
/**
 * scripts/migrate.mjs
 *
 * Script di chuyển dữ liệu từ folder public/huongdan lên Redis (node-redis).
 * Chạy 1 lần tại máy local:
 *   node scripts/migrate.mjs
 *
 * Yêu cầu:
 *   - File .env.local có REDIS_URL (hoặc KV_URL)
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createClient } from 'redis';

// --- Load .env.local ---
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

function loadEnvLocal() {
    const envPath = join(projectRoot, '.env.local');
    if (!existsSync(envPath)) {
        console.error('❌ Không tìm thấy .env.local');
        process.exit(1);
    }
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq < 0) continue;
        const key = trimmed.slice(0, eq).trim();
        const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) process.env[key] = val;
    }
}
loadEnvLocal();

const REDIS_URL = process.env.REDIS_URL || process.env.KV_URL || process.env.REDIS_REST_URL;

if (!REDIS_URL) {
    console.error('❌ Thiếu REDIS_URL (hoặc KV_URL) trong .env.local');
    process.exit(1);
}

// --- Redis helpers dùng node-redis ---
const INDEX_KEY = 'docs:index';

async function redisGet(client, key) {
    const raw = await client.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return raw; }
}

async function redisSet(client, key, value) {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    await client.set(key, str);
}

// --- Làm sạch text ---
function cleanText(text) {
    return text
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/(\n\s*){3,}/g, '\n\n')
        .replace(/^\s+|\s+$/gm, '')
        .trim();
}

// --- Đọc file Word ---
const require = createRequire(import.meta.url);

async function readDocx(filePath) {
    const mammoth = require('mammoth');
    const buffer = readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
}

async function readDoc(filePath) {
    const WordExtractor = require('word-extractor');
    const extractor = new WordExtractor();
    const extracted = await extractor.extract(filePath);
    return extracted.getBody() || '';
}

// --- Lưu doc lên Redis ---
async function saveDoc(client, title, content) {
    let index = await redisGet(client, INDEX_KEY);
    if (!Array.isArray(index)) index = [];

    // Kiểm tra trùng title → ghi đè
    const existingIdx = index.findIndex(
        (d) => d.title.trim().toLowerCase() === title.trim().toLowerCase()
    );

    let docId;
    if (existingIdx >= 0) {
        docId = index[existingIdx].id;
        index[existingIdx] = { id: docId, title, length: content.length };
        console.log(`  ⚠️  Ghi đè tài liệu đã có: "${title}"`);
    } else {
        docId = crypto.randomUUID();
        index.push({ id: docId, title, length: content.length });
    }

    const doc = { id: docId, title, content };
    await redisSet(client, `doc:${docId}`, doc);
    await redisSet(client, INDEX_KEY, index);
    return docId;
}

// --- Main ---
async function main() {
    const huongdanDir = join(projectRoot, 'public', 'huongdan');
    if (!existsSync(huongdanDir)) {
        console.error('❌ Không tìm thấy folder public/huongdan');
        process.exit(1);
    }

    // Kết nối Redis
    const client = createClient({ url: REDIS_URL });
    client.on('error', (err) => console.error('[Redis] Lỗi:', err.message));
    await client.connect();
    console.log('[Redis] Đã kết nối.\n');

    const files = readdirSync(huongdanDir);
    const supportedFiles = files.filter(f => {
        const ext = extname(f).toLowerCase();
        return ext === '.doc' || ext === '.docx';
    });

    console.log(`🚀 Bắt đầu migrate ${supportedFiles.length} file từ public/huongdan lên Redis...\n`);

    let ok = 0;
    let fail = 0;

    for (const filename of supportedFiles) {
        const filePath = join(huongdanDir, filename);
        const ext = extname(filename).toLowerCase();
        const title = basename(filename, ext).trim();

        process.stdout.write(`📄 ${filename} ... `);

        try {
            let rawText = '';
            if (ext === '.docx') {
                rawText = await readDocx(filePath);
            } else {
                rawText = await readDoc(filePath);
            }

            const content = cleanText(rawText);
            if (!content) {
                console.log('⚠️  Bỏ qua: không có chữ (file scan?)');
                fail++;
                continue;
            }

            await saveDoc(client, title, content);
            console.log(`✅  ${content.length.toLocaleString()} ký tự`);
            ok++;
        } catch (err) {
            console.log(`❌  Lỗi: ${err.message}`);
            fail++;
        }
    }

    await client.quit();
    console.log(`\n✅ Hoàn tất: ${ok} thành công, ${fail} thất bại.\n`);
    console.log('👉 Kiểm tra bot hoạt động đúng rồi mới xóa folder public/huongdan.\n');
}

main().catch(err => {
    console.error('❌ Lỗi không xử lý được:', err);
    process.exit(1);
});
