"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
    BookOpen,
    ChevronRight,
    Edit3,
    Save,
    X,
    Plus,
    Trash2,
    GripVertical,
    ArrowUp,
    ArrowDown,
    Check,
    Loader2,
    ArrowLeft,
    Search,
    Printer,
} from "lucide-react";
import { csrfFetch } from "@/lib/csrfFetch";

/* ─── Types ─────────────────────────────────────────────────────── */

interface GuideSection {
    id: string;
    title: string;
    content: string;
    order: number;
}

interface GuideData {
    id: string;
    title: string;
    sections: GuideSection[];
    updated_at: string;
    updated_by: string;
}

/* ─── Markdown-lite renderer ────────────────────────────────────── */

function renderMarkdown(md: string): string {
    let html = md
        // Escape HTML
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // Headers
        .replace(/^### (.+)$/gm, '<h4 class="text-base font-semibold text-slate-800 mt-6 mb-2">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 class="text-lg font-bold text-slate-900 mt-8 mb-3">$1</h3>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // Italic
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        // Inline code
        .replace(/`(.+?)`/g, '<code class="rounded bg-slate-100 px-1.5 py-0.5 text-sm font-mono text-slate-700">$1</code>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr class="my-6 border-slate-200" />')
        // Links (sanitize href to reject javascript:/data: XSS)
        .replace(/\[(.+?)\]\((.+?)\)/g, (_m: string, text: string, url: string) => {
            const safeUrl = /^(https?:\/\/|mailto:|\/)/i.test(url) ? url : "#";
            return `<a href="${safeUrl}" class="text-blue-600 underline hover:text-blue-800" target="_blank" rel="noopener noreferrer">${text}</a>`;
        });

    // Tables
    html = html.replace(
        /(?:^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)+))/gm,
        (_match, header: string, _sep: string, body: string) => {
            const heads = header.split("|").filter(Boolean).map((c: string) => c.trim());
            const rows = body.trim().split("\n").map((r: string) =>
                r.split("|").filter(Boolean).map((c: string) => c.trim())
            );
            let t = '<div class="overflow-x-auto my-4"><table class="min-w-full text-sm border border-slate-200 rounded-lg overflow-hidden"><thead class="bg-slate-50"><tr>';
            heads.forEach((h: string) => { t += `<th class="px-4 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">${h}</th>`; });
            t += "</tr></thead><tbody>";
            rows.forEach((row: string[], i: number) => {
                t += `<tr class="${i % 2 === 0 ? "bg-white" : "bg-slate-50"}">`;
                row.forEach((c: string) => { t += `<td class="px-4 py-2 border-b border-slate-100 text-slate-600">${c}</td>`; });
                t += "</tr>";
            });
            t += "</tbody></table></div>";
            return t;
        }
    );

    // Ordered lists
    html = html.replace(
        /(?:^(\d+\. .+)(?:\n(?:\d+\. .+))*)/gm,
        (block) => {
            const items = block.split("\n").map((line) =>
                line.replace(/^\d+\.\s/, "")
            );
            return `<ol class="list-decimal list-inside space-y-1 my-3 text-slate-600">${items.map((i) => `<li>${i}</li>`).join("")}</ol>`;
        }
    );

    // Unordered lists
    html = html.replace(
        /(?:^- .+(?:\n- .+)*)/gm,
        (block) => {
            const items = block.split("\n").map((line) => line.replace(/^- /, ""));
            return `<ul class="list-disc list-inside space-y-1 my-3 text-slate-600">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
        }
    );

    // Paragraphs (non-empty lines that aren't already HTML)
    html = html
        .split("\n")
        .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return "";
            if (trimmed.startsWith("<")) return trimmed;
            return `<p class="my-2 text-slate-600 leading-relaxed">${trimmed}</p>`;
        })
        .join("\n");

    // Emoji replacements for status indicators
    html = html
        .replace(/🟢/g, '<span class="inline-block w-3 h-3 rounded-full bg-emerald-500 mr-1 align-middle"></span>')
        .replace(/🟡/g, '<span class="inline-block w-3 h-3 rounded-full bg-amber-400 mr-1 align-middle"></span>')
        .replace(/🔴/g, '<span class="inline-block w-3 h-3 rounded-full bg-red-500 mr-1 align-middle"></span>')
        .replace(/🔵/g, '<span class="inline-block w-3 h-3 rounded-full bg-blue-500 mr-1 align-middle"></span>')
        .replace(/🟣/g, '<span class="inline-block w-3 h-3 rounded-full bg-purple-500 mr-1 align-middle"></span>');

    return html;
}

/* ─── Component ─────────────────────────────────────────────────── */

export default function UserGuidePage() {
    const [guide, setGuide] = useState<GuideData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editSections, setEditSections] = useState<GuideSection[]>([]);
    const [editTitle, setEditTitle] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");

    // Auth - check if super_admin
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    // Search
    const [searchQuery, setSearchQuery] = useState("");

    // Active section (for TOC highlighting)
    const [activeSection, setActiveSection] = useState<string>("");
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

    // Check user role
    useEffect(() => {
        try {
            const role = localStorage.getItem("skymaintain.userRole");
            setIsSuperAdmin(role === "super_admin");
        } catch {
            setIsSuperAdmin(false);
        }
    }, []);

    // Fetch guide
    const fetchGuide = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/user-guide");
            if (!res.ok) throw new Error("Failed to load user guide");
            const data: GuideData = await res.json();
            setGuide(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Unknown error");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGuide();
    }, [fetchGuide]);

    // Intersection Observer for TOC highlighting
    useEffect(() => {
        if (!guide) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                }
            },
            { rootMargin: "-100px 0px -60% 0px", threshold: 0 }
        );
        Object.values(sectionRefs.current).forEach((el) => {
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [guide, isEditing]);

    // Filter sections by search
    const filteredSections = guide?.sections.filter((s) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q);
    }) || [];

    /* ─── Edit helpers ────────────────────────────────────────── */

    const startEditing = () => {
        if (!guide) return;
        setEditTitle(guide.title);
        setEditSections(guide.sections.map((s) => ({ ...s })));
        setIsEditing(true);
        setSaveStatus("idle");
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditSections([]);
        setSaveStatus("idle");
    };

    const updateSection = (id: string, field: keyof GuideSection, value: string | number) => {
        setEditSections((prev) =>
            prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
        );
    };

    const moveSection = (id: string, direction: "up" | "down") => {
        setEditSections((prev) => {
            const idx = prev.findIndex((s) => s.id === id);
            if (idx < 0) return prev;
            const newIdx = direction === "up" ? idx - 1 : idx + 1;
            if (newIdx < 0 || newIdx >= prev.length) return prev;
            const copy = [...prev];
            [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
            return copy.map((s, i) => ({ ...s, order: i + 1 }));
        });
    };

    const addSection = () => {
        const newId = `section-${Date.now()}`;
        setEditSections((prev) => [
            ...prev,
            {
                id: newId,
                title: `${prev.length + 1}. New Section`,
                content: "## New Section\n\nAdd your content here.",
                order: prev.length + 1,
            },
        ]);
    };

    const removeSection = (id: string) => {
        setEditSections((prev) =>
            prev.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i + 1 }))
        );
    };

    const saveGuide = async () => {
        setIsSaving(true);
        setSaveStatus("idle");
        try {
            const res = await csrfFetch("/api/user-guide", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: editTitle,
                    sections: editSections,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to save");
            }
            const saved: GuideData = await res.json();
            setGuide(saved);
            setIsEditing(false);
            setSaveStatus("success");
            setTimeout(() => setSaveStatus("idle"), 3000);
        } catch (e) {
            setSaveStatus("error");
            console.error("Save failed:", e);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => window.print();

    /* ─── Render ──────────────────────────────────────────────── */

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-slate-500">Loading user guide...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                    <p className="text-red-700">{error}</p>
                    <button onClick={fetchGuide} className="mt-3 text-sm text-blue-600 underline">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white print:bg-white">
            {/* ─── Top Bar ──────────────────────────────────────── */}
            <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm print:hidden">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
                    <div className="flex items-center gap-3">
                        <Link href="/" className="flex items-center gap-2 text-slate-700 hover:text-blue-600 transition-colors">
                            <ArrowLeft className="h-4 w-4" />
                            <span className="text-sm font-medium">Back to Home</span>
                        </Link>
                        <span className="text-slate-300">/</span>
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-blue-600" />
                            <span className="text-sm font-semibold text-slate-900">{guide?.title || "User Guide"}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search guide..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-300 w-56"
                            />
                        </div>
                        <button
                            onClick={handlePrint}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                        >
                            <Printer className="h-4 w-4" />
                        </button>
                        {isSuperAdmin && !isEditing && (
                            <button
                                onClick={startEditing}
                                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                            >
                                <Edit3 className="h-3.5 w-3.5" />
                                Edit Guide
                            </button>
                        )}
                        {isEditing && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={cancelEditing}
                                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Cancel
                                </button>
                                <button
                                    onClick={saveGuide}
                                    disabled={isSaving}
                                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                >
                                    {isSaving ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                        <Save className="h-3.5 w-3.5" />
                                    )}
                                    Save Guide
                                </button>
                            </div>
                        )}
                        {saveStatus === "success" && (
                            <span className="flex items-center gap-1 text-sm text-emerald-600">
                                <Check className="h-4 w-4" /> Saved
                            </span>
                        )}
                        {saveStatus === "error" && (
                            <span className="text-sm text-red-600">Save failed</span>
                        )}
                    </div>
                </div>
            </header>

            <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8 print:max-w-none print:p-0">
                {/* ─── Table of Contents (sidebar) ──────────────── */}
                <aside className="sticky top-20 hidden h-fit w-64 shrink-0 lg:block print:hidden">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Contents</span>
                        </div>
                        <nav className="space-y-1">
                            {(isEditing ? editSections : filteredSections).map((section) => (
                                <a
                                    key={section.id}
                                    href={`#${section.id}`}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                                        activeSection === section.id
                                            ? "bg-blue-50 text-blue-700 font-medium"
                                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                    }`}
                                >
                                    <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${activeSection === section.id ? "text-blue-600" : "text-slate-300"}`} />
                                    <span className="truncate">{section.title}</span>
                                </a>
                            ))}
                        </nav>

                        {guide?.updated_at && (
                            <div className="mt-6 border-t border-slate-100 pt-4">
                                <p className="text-xs text-slate-400">
                                    Last updated<br />
                                    {new Date(guide.updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                                </p>
                                {guide.updated_by && guide.updated_by !== "system" && (
                                    <p className="mt-1 text-xs text-slate-400">by {guide.updated_by}</p>
                                )}
                            </div>
                        )}
                    </div>
                </aside>

                {/* ─── Main Content ─────────────────────────────── */}
                <main className="min-w-0 flex-1">
                    {/* Title */}
                    {isEditing ? (
                        <div className="mb-8">
                            <label className="mb-1 block text-xs font-medium text-slate-500">Guide Title</label>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-2xl font-bold text-slate-900 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                            />
                        </div>
                    ) : (
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 print:text-4xl">
                                {guide?.title}
                            </h1>
                            <p className="mt-2 text-slate-500">
                                Everything you need to navigate and get the most from SkyMaintain
                            </p>
                        </div>
                    )}

                    {/* Editing info banner */}
                    {isEditing && (
                        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                            <strong>Editing Mode</strong> — You can edit section titles and content (Markdown supported), reorder sections, add new sections, or remove existing ones. Click <strong>Save Guide</strong> when done.
                        </div>
                    )}

                    {searchQuery && filteredSections.length === 0 && !isEditing && (
                        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-400">
                            No sections match &ldquo;{searchQuery}&rdquo;
                        </div>
                    )}

                    {/* Sections */}
                    <div className="space-y-8">
                        {(isEditing ? editSections : filteredSections).map((section, idx) => (
                            <div
                                key={section.id}
                                id={section.id}
                                ref={(el) => { sectionRefs.current[section.id] = el; }}
                                className={`rounded-2xl border bg-white shadow-sm print:shadow-none print:border-0 print:rounded-none ${
                                    isEditing ? "border-blue-200" : "border-slate-200"
                                }`}
                            >
                                {isEditing ? (
                                    <div className="p-6">
                                        {/* Section edit header */}
                                        <div className="mb-4 flex items-center gap-3">
                                            <GripVertical className="h-5 w-5 text-slate-300" />
                                            <input
                                                type="text"
                                                value={section.title}
                                                onChange={(e) => updateSection(section.id, "title", e.target.value)}
                                                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-lg font-semibold text-slate-900 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                                            />
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => moveSection(section.id, "up")}
                                                    disabled={idx === 0}
                                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                                                    title="Move up"
                                                >
                                                    <ArrowUp className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => moveSection(section.id, "down")}
                                                    disabled={idx === editSections.length - 1}
                                                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30"
                                                    title="Move down"
                                                >
                                                    <ArrowDown className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => removeSection(section.id)}
                                                    className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
                                                    title="Remove section"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </div>
                                        {/* Content editor */}
                                        <textarea
                                            value={section.content}
                                            onChange={(e) => updateSection(section.id, "content", e.target.value)}
                                            rows={16}
                                            className="w-full rounded-lg border border-slate-200 p-4 font-mono text-sm text-slate-700 focus:border-blue-300 focus:outline-none focus:ring-1 focus:ring-blue-300"
                                            placeholder="Write section content in Markdown..."
                                        />
                                        {/* Live preview */}
                                        <details className="mt-3">
                                            <summary className="cursor-pointer text-xs font-medium text-blue-600 hover:text-blue-800">
                                                Preview rendered content
                                            </summary>
                                            <div
                                                className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-4"
                                                dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
                                            />
                                        </details>
                                    </div>
                                ) : (
                                    <div className="p-8">
                                        <h2 className="mb-4 text-xl font-bold text-slate-900 print:text-2xl">
                                            {section.title}
                                        </h2>
                                        <div
                                            className="prose-guide"
                                            dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
                                        />
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* Add section button (editing only) */}
                        {isEditing && (
                            <button
                                onClick={addSection}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-6 text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
                            >
                                <Plus className="h-4 w-4" />
                                Add New Section
                            </button>
                        )}
                    </div>

                    {/* Footer */}
                    {!isEditing && (
                        <div className="mt-12 rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-8 text-center print:hidden">
                            <h3 className="text-lg font-semibold text-slate-900">Need More Help?</h3>
                            <p className="mt-2 text-sm text-slate-600">
                                Our team is here to help you get the most from SkyMaintain.
                            </p>
                            <div className="mt-4 flex items-center justify-center gap-4">
                                <Link
                                    href="/contact"
                                    className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                                >
                                    Contact Support
                                </Link>
                                <Link
                                    href="/signin"
                                    className="rounded-lg border border-slate-200 bg-white px-6 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                                >
                                    Sign In
                                </Link>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
