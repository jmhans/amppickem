import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import Header from './ui/header';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AMP Pick'em",
  description: "AMP Pick'em — weekly NFL spread and over/under pool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Auth0Provider>
          <div className="min-h-screen bg-white dark:bg-gray-900">
            <div className="p-4 md:p-6">
              <Header />
              {children}
            </div>
          </div>
        </Auth0Provider>
      </body>
    </html>
  );
}
