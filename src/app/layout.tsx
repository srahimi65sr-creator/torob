import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import "./globals.css";

// Torob uses IRANYekan, which is licensed; Vazirmatn is the closest open font.
const vazirmatn = Vazirmatn({ variable: "--font-vazirmatn", subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: "ترب بیمه | مقایسه‌ی قیمت بیمه‌ی شخص ثالث",
  description: "قیمت نهایی بیمه‌ی شخص ثالث از فروشنده‌های مختلف، کنار هم.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl">
      <body className={`${vazirmatn.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
