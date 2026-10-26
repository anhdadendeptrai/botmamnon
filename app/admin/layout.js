export const metadata = {
    title: 'Quản trị - Mầm non Sơn Thủy',
    robots: {
        index: false,
        follow: false,
    },
};

export default function AdminLayout({ children }) {
    return (
        <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {children}
        </div>
    );
}
