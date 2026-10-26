'use client';

import { useState, useEffect, useRef } from 'react';

// ==================== STYLES ====================
const S = {
    page: {
        minHeight: '100%',
        background: '#f0fdf4',
        fontFamily: 'var(--font-nunito, Nunito, sans-serif)',
        padding: '16px 16px 80px 16px',
    },
    card: {
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        padding: '20px',
        marginBottom: '16px',
    },
    h1: {
        fontSize: '22px',
        fontWeight: 800,
        color: '#065f46',
        marginBottom: '4px',
    },
    label: {
        fontSize: '13px',
        fontWeight: 700,
        color: '#374151',
        display: 'block',
        marginBottom: '4px',
    },
    input: {
        width: '100%',
        padding: '10px 14px',
        border: '1.5px solid #d1fae5',
        borderRadius: '10px',
        fontSize: '15px',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
    },
    textarea: {
        width: '100%',
        padding: '10px 14px',
        border: '1.5px solid #d1fae5',
        borderRadius: '10px',
        fontSize: '14px',
        outline: 'none',
        boxSizing: 'border-box',
        fontFamily: 'inherit',
        minHeight: '140px',
        resize: 'vertical',
    },
    btnGreen: {
        background: 'linear-gradient(135deg, #059669, #34d399)',
        color: '#fff',
        border: 'none',
        borderRadius: '10px',
        padding: '10px 20px',
        fontWeight: 700,
        fontSize: '15px',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    btnGray: {
        background: '#f3f4f6',
        color: '#374151',
        border: 'none',
        borderRadius: '10px',
        padding: '10px 16px',
        fontWeight: 700,
        fontSize: '14px',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    btnRed: {
        background: '#fee2e2',
        color: '#b91c1c',
        border: 'none',
        borderRadius: '8px',
        padding: '6px 12px',
        fontWeight: 700,
        fontSize: '13px',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    btnEdit: {
        background: '#dbeafe',
        color: '#1d4ed8',
        border: 'none',
        borderRadius: '8px',
        padding: '6px 12px',
        fontWeight: 700,
        fontSize: '13px',
        cursor: 'pointer',
        fontFamily: 'inherit',
    },
    tag: (color) => ({
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 700,
        background: color === 'green' ? '#d1fae5' : color === 'red' ? '#fee2e2' : '#fef9c3',
        color: color === 'green' ? '#065f46' : color === 'red' ? '#b91c1c' : '#92400e',
    }),
};

// ==================== LOGIN ====================
function LoginForm({ onLogin }) {
    const [pw, setPw] = useState('');
    const [err, setErr] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!pw.trim()) return;
        setLoading(true);
        setErr('');
        try {
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pw }),
            });
            if (res.ok) {
                onLogin();
            } else {
                const data = await res.json().catch(() => ({}));
                setErr(data.error || 'Mật khẩu không đúng.');
            }
        } catch {
            setErr('Lỗi kết nối. Thử lại.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0fdf4', padding: '16px' }}>
            <div style={{ ...S.card, width: '100%', maxWidth: '360px' }}>
                <h1 style={S.h1}>🔒 Đăng nhập Admin</h1>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '18px' }}>Trợ lý AI Mầm non Sơn Thủy</p>
                <form onSubmit={handleSubmit}>
                    <label style={S.label}>Mật khẩu quản trị</label>
                    <input
                        type="password"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        placeholder="Nhập mật khẩu..."
                        style={{ ...S.input, marginBottom: '12px' }}
                        autoFocus
                    />
                    {err && (
                        <p style={{ color: '#b91c1c', fontSize: '13px', marginBottom: '10px', fontWeight: 600 }}>
                            ⚠️ {err}
                        </p>
                    )}
                    <button type="submit" style={{ ...S.btnGreen, width: '100%' }} disabled={loading}>
                        {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                    </button>
                </form>
            </div>
        </div>
    );
}

// ==================== MAIN ADMIN ====================
export default function AdminPage() {
    const [authed, setAuthed] = useState(null); // null=loading, false=chưa login, true=đã login
    const [index, setIndex] = useState([]);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({ id: '', title: '', content: '' });
    const [isEditing, setIsEditing] = useState(false);
    const [loadingForm, setLoadingForm] = useState(false);
    const [formMsg, setFormMsg] = useState(null); // {type:'ok'|'err', text}
    const [uploadResults, setUploadResults] = useState([]); // [{name, status:'pending'|'ok'|'err', msg}]
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const formRef = useRef(null);

    // ---- Kiểm tra xác thực khi load ----
    useEffect(() => {
        fetch('/api/admin/docs')
            .then((r) => {
                if (r.ok) {
                    setAuthed(true);
                    return r.json().then(setIndex);
                } else {
                    setAuthed(false);
                }
            })
            .catch(() => setAuthed(false));
    }, []);

    // ---- Load danh sách ----
    const loadIndex = async () => {
        const res = await fetch('/api/admin/docs');
        if (res.ok) setIndex(await res.json());
    };

    // ---- Đăng xuất ----
    const handleLogout = async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        setAuthed(false);
    };

    // ---- Lưu tài liệu ----
    const handleSave = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.content.trim()) {
            setFormMsg({ type: 'err', text: 'Tiêu đề và nội dung không được để trống.' });
            return;
        }
        setLoadingForm(true);
        setFormMsg(null);
        try {
            const res = await fetch('/api/admin/docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: form.id || undefined, title: form.title, content: form.content }),
            });
            const data = await res.json();
            if (res.ok) {
                setFormMsg({ type: 'ok', text: `✅ Đã lưu: "${data.title}"` });
                setForm({ id: '', title: '', content: '' });
                setIsEditing(false);
                await loadIndex();
            } else {
                setFormMsg({ type: 'err', text: data.error || 'Lỗi lưu tài liệu.' });
            }
        } catch {
            setFormMsg({ type: 'err', text: 'Lỗi kết nối.' });
        } finally {
            setLoadingForm(false);
        }
    };

    // ---- Sửa: tải nội dung ----
    const handleEdit = async (entry) => {
        setFormMsg(null);
        setIsEditing(true);
        setForm({ id: entry.id, title: entry.title, content: '...đang tải...' });
        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
            const res = await fetch(`/api/admin/docs?id=${entry.id}`);
            const doc = await res.json();
            setForm({ id: doc.id, title: doc.title, content: doc.content });
        } catch {
            setFormMsg({ type: 'err', text: 'Lỗi tải nội dung.' });
        }
    };

    // ---- Hủy sửa ----
    const handleCancel = () => {
        setForm({ id: '', title: '', content: '' });
        setIsEditing(false);
        setFormMsg(null);
    };

    // ---- Xóa ----
    const handleDelete = async (entry) => {
        if (!confirm(`Xóa tài liệu "${entry.title}"?\nHành động này không thể hoàn tác.`)) return;
        const res = await fetch('/api/admin/docs', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: entry.id }),
        });
        if (res.ok) {
            await loadIndex();
        } else {
            alert('Lỗi xóa tài liệu.');
        }
    };

    // ---- Upload nhiều file ----
    const handleUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploading(true);
        // Khởi tạo danh sách kết quả với trạng thái pending
        const initial = files.map((f) => ({ name: f.name, status: 'pending', msg: '' }));
        setUploadResults(initial);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const fd = new FormData();
            fd.append('file', file);
            try {
                const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
                const data = await res.json();
                setUploadResults((prev) =>
                    prev.map((r, idx) =>
                        idx === i
                            ? {
                                ...r,
                                status: res.ok ? 'ok' : 'err',
                                msg: res.ok
                                    ? `✅ ${data.length?.toLocaleString()} ký tự`
                                    : `❌ ${data.error}`,
                            }
                            : r
                    )
                );
            } catch {
                setUploadResults((prev) =>
                    prev.map((r, idx) =>
                        idx === i ? { ...r, status: 'err', msg: '❌ Lỗi kết nối.' } : r
                    )
                );
            }
        }

        setUploading(false);
        // Reset input để có thể chọn lại cùng file
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadIndex();
    };

    // ==================== RENDER ====================

    if (authed === null) {
        return (
            <div style={{ ...S.page, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <p style={{ color: '#6b7280', fontWeight: 700 }}>Đang kiểm tra xác thực...</p>
            </div>
        );
    }

    if (authed === false) {
        return <LoginForm onLogin={() => { setAuthed(true); loadIndex(); }} />;
    }

    const filtered = index.filter((d) =>
        d.title.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={S.page}>
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ ...S.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <h1 style={S.h1}>⚙️ Quản lý tài liệu</h1>
                        <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
                            Mầm non Sơn Thủy · {index.length} tài liệu
                        </p>
                    </div>
                    <button onClick={handleLogout} style={S.btnGray}>Đăng xuất</button>
                </div>

                {/* Upload nhiều file */}
                <div style={S.card}>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#065f46', marginBottom: '10px' }}>
                        📂 Upload file Word
                    </h2>
                    <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '10px' }}>
                        Chọn nhiều file .doc/.docx cùng lúc. Server tự trích text và lưu vào database.
                        Nếu tên file đã tồn tại thì ghi đè.
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".doc,.docx"
                        multiple
                        onChange={handleUpload}
                        disabled={uploading}
                        style={{ fontSize: '14px', marginBottom: '10px' }}
                    />
                    {uploadResults.length > 0 && (
                        <div style={{ marginTop: '8px' }}>
                            {uploadResults.map((r, i) => (
                                <div
                                    key={i}
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '6px 0',
                                        borderBottom: '1px solid #f3f4f6',
                                        gap: '8px',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    <span style={{ fontSize: '13px', color: '#374151', wordBreak: 'break-all', flex: 1 }}>
                                        {r.name}
                                    </span>
                                    <span
                                        style={S.tag(
                                            r.status === 'ok' ? 'green' : r.status === 'err' ? 'red' : 'yellow'
                                        )}
                                    >
                                        {r.status === 'pending' ? '⏳ Đang xử lý...' : r.msg}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Form thêm/sửa */}
                <div style={S.card} ref={formRef}>
                    <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#065f46', marginBottom: '14px' }}>
                        {isEditing ? '✏️ Sửa tài liệu' : '➕ Thêm tài liệu mới'}
                    </h2>
                    <form onSubmit={handleSave}>
                        <label style={S.label}>Tiêu đề</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="Tiêu đề tài liệu..."
                            style={{ ...S.input, marginBottom: '12px' }}
                        />
                        <label style={S.label}>Nội dung</label>
                        <textarea
                            value={form.content}
                            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                            placeholder="Dán hoặc nhập nội dung tài liệu..."
                            style={{ ...S.textarea, marginBottom: '12px' }}
                        />
                        {formMsg && (
                            <p
                                style={{
                                    color: formMsg.type === 'ok' ? '#065f46' : '#b91c1c',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    marginBottom: '10px',
                                }}
                            >
                                {formMsg.text}
                            </p>
                        )}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <button type="submit" style={S.btnGreen} disabled={loadingForm}>
                                {loadingForm ? 'Đang lưu...' : '💾 Lưu tài liệu'}
                            </button>
                            {isEditing && (
                                <button type="button" onClick={handleCancel} style={S.btnGray}>
                                    Hủy
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* Danh sách */}
                <div style={S.card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                        <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#065f46', margin: 0 }}>
                            📋 Danh sách tài liệu
                        </h2>
                        <span style={S.tag('green')}>{filtered.length}/{index.length}</span>
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Tìm theo tiêu đề..."
                        style={{ ...S.input, marginBottom: '12px' }}
                    />
                    {filtered.length === 0 ? (
                        <p style={{ color: '#9ca3af', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>
                            {index.length === 0 ? 'Chưa có tài liệu nào.' : 'Không tìm thấy kết quả.'}
                        </p>
                    ) : (
                        filtered.map((entry) => (
                            <div
                                key={entry.id}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '10px 0',
                                    borderBottom: '1px solid #f3f4f6',
                                    gap: '8px',
                                    flexWrap: 'wrap',
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#1f2937', wordBreak: 'break-word' }}>
                                        {entry.title}
                                    </p>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>
                                        {entry.length?.toLocaleString()} ký tự
                                    </p>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                    <button onClick={() => handleEdit(entry)} style={S.btnEdit}>Sửa</button>
                                    <button onClick={() => handleDelete(entry)} style={S.btnRed}>Xóa</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
