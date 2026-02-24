import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
    subsets: ['vietnamese', 'latin'],
    weight: ['400', '500', '600', '700', '800'],
    display: 'swap',
    variable: '--font-nunito',
});

export const metadata = {
    title: 'Trợ lý AI Trường mầm non Ninh Lai',
    description: 'Chatbot hỗ trợ thông tin cho phụ huynh Trường Mầm non Ninh Lai. Giải đáp thắc mắc về nhập học, lịch học, thực đơn và các thông tin nhà trường.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="vi" className={nunito.variable} suppressHydrationWarning>
            <body className={`${nunito.className} antialiased`} suppressHydrationWarning>
                {children}
            </body>
        </html>
    );
}
