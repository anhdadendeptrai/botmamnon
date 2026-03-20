import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';

// Test 1: Check if file exists
const filePath = path.join(process.cwd(), 'public', 'huongdan', 'thucdonchitiet.docx');
console.log('=== TEST 1: File exists? ===');
console.log('Path:', filePath);
console.log('Exists:', fs.existsSync(filePath));

// Test 2: Read file content with mammoth
console.log('\n=== TEST 2: Read content with mammoth ===');
try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const content = result.value;
    console.log('Content length:', content.length, 'chars');
    console.log('First 1000 chars:');
    console.log(content.slice(0, 1000));
    console.log('\n--- Content contains "Thứ 5"?', content.includes('Thứ 5'));
    console.log('--- Content contains "MẪU GIÁO"?', content.includes('MẪU GIÁO'));
    console.log('--- Content contains "mẫu giáo"?', content.toLowerCase().includes('mẫu giáo'));
    console.log('--- Content contains "Bữa chính"?', content.includes('Bữa chính'));
} catch (err) {
    console.error('ERROR reading file:', err.message);
}

// Test 3: Also check thucdon.docx for comparison
const filePath2 = path.join(process.cwd(), 'public', 'huongdan', 'thucdon.docx');
console.log('\n=== TEST 3: thucdon.docx content ===');
try {
    const buffer2 = fs.readFileSync(filePath2);
    const result2 = await mammoth.extractRawText({ buffer: buffer2 });
    console.log('Content length:', result2.value.length, 'chars');
    console.log('First 500 chars:');
    console.log(result2.value.slice(0, 500));
} catch (err) {
    console.error('ERROR:', err.message);
}
