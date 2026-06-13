/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

export default function PublicHeader() {
    const router = useRouter();
    const pathname = usePathname();
    const { isAuthenticated, logout, isLoading } = useAuth();
    const [mobileOpen, setMobileOpen] = useState(false);

    // Hide platform-access links on the 2FA page — user hasn't verified yet
    const on2faPage = pathname === "/2fa";

    function handleLogout() {
        logout();
        router.push("/");
    }

    const navLinks = [
        { href: "/platform", label: "Platform" },
        { href: "/enterprise", label: "Enterprise" },
        { href: "/compliance", label: "Compliance" },
        { href: "/security", label: "Security" },
        { href: "/get-started", label: "Partnerships" },
        { href: "/user-guide", label: "User Guide" },
        { href: "/contact", label: "Contact" },
    ];

    return (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-6 py-4">
                <Link href="/" className="flex shrink-0 items-center gap-2">
                    <img src="/brand/SkyMaintain_logo.png" alt="SkyMaintain" className="h-8 w-8" />
                    <span className="text-xl font-bold text-slate-900">SkyMaintain</span>
                </Link>

                {/* Desktop nav */}
                <nav className="hidden items-center gap-6 md:flex">
                    {navLinks.map((link) => (
                        <Link key={link.href} href={link.href} className="text-base text-slate-600 hover:text-slate-900">
                            {link.label}
                        </Link>
                    ))}

                    {/* Auth-aware Sign In / Log Out button */}
                    {/* Hide platform links on /2fa — user has not completed verification yet */}
                    {isLoading ? (
                        <span className="text-sm text-slate-400">...</span>
                    ) : isAuthenticated && !on2faPage ? (
                        <>
                            <Link
                                href="/app/welcome"
                                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                            >
                                Go to Hub
                            </Link>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                            >
                                Log Out
                            </button>
                        </>
                    ) : !isAuthenticated ? (
                        <Link href="/signin" className="text-sm text-slate-600 hover:text-slate-900">
                            Sign In
                        </Link>
                    ) : null}

                    {isAuthenticated && !on2faPage ? (
                        <Link
                            href="/app/welcome"
                            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
                        >
                            Open Platform
                        </Link>
                    ) : !isAuthenticated ? (
                        <Link
                            href="/#signup"
                            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white"
                        >
                            Start Free Trial
                        </Link>
                    ) : null}
                </nav>

                {/* Mobile hamburger */}
                <button
                    type="button"
                    className="flex items-center justify-center rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
                    onClick={() => setMobileOpen((prev) => !prev)}
                    aria-label={mobileOpen ? "Close menu" : "Open menu"}
                >
                    {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </div>

            {/* Mobile dropdown menu */}
            {mobileOpen && (
                <div className="border-t border-slate-200 bg-white px-6 pb-6 pt-4 md:hidden">
                    <nav className="flex flex-col gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="rounded-lg px-3 py-3 text-base text-slate-700 hover:bg-slate-50"
                                onClick={() => setMobileOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <div className="my-3 border-t border-slate-100" />
                        {isLoading ? (
                            <span className="px-3 text-sm text-slate-400">...</span>
                        ) : isAuthenticated && !on2faPage ? (
                            <>
                                <Link
                                    href="/app/welcome"
                                    className="rounded-lg px-3 py-3 text-base font-medium text-indigo-600 hover:bg-indigo-50"
                                    onClick={() => setMobileOpen(false)}
                                >
                                    Open Platform
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => { setMobileOpen(false); handleLogout(); }}
                                    className="rounded-lg px-3 py-3 text-left text-base text-slate-700 hover:bg-slate-50"
                                >
                                    Log Out
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/signin"
                                    className="rounded-lg px-3 py-3 text-base text-slate-700 hover:bg-slate-50"
                                    onClick={() => setMobileOpen(false)}
                                >
                                    Sign In
                                </Link>
                                <Link
                                    href="/#signup"
                                    className="mt-2 rounded-lg bg-slate-950 px-4 py-3 text-center text-base font-medium text-white"
                                    onClick={() => setMobileOpen(false)}
                                >
                                    Start Free Trial
                                </Link>
                            </>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
}
