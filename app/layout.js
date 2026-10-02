import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import ThemeSync from "@/components/ThemeSync";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: {
    default: "Btel Attendance",
    template: "%s · Btel Attendance",
  },
  description: "Sign in and out of the Btel office, and review staff attendance.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Script id="btel-theme" strategy="beforeInteractive">
          {`(function () {
            try {
              var stored = localStorage.getItem("btel_theme");
              var theme = stored === "light" || stored === "dark"
                ? stored
                : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
              document.documentElement.classList.toggle("dark", theme === "dark");
              var link = document.querySelector('link[rel="icon"]');
              if (!link) {
                link = document.createElement("link");
                link.rel = "icon";
                document.head.appendChild(link);
              }
              link.type = "image/svg+xml";
              link.href = theme === "dark" ? "/icon-dark.svg" : "/icon-light.svg";
            } catch (e) {}
          })();`}
        </Script>
        <ThemeSync />
        {children}
      </body>
    </html>
  );
}
