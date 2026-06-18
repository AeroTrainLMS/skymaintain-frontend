/**
 * @skymain.design
 * fileKey: qz3ERP8jfbTpTHQrdPSawI
 * nodeId: 2:1304
 * specHash: sha256:app-shell-sidebar-v1
 */

/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
    LayoutDashboard,
    FileText,
    Bell,
    ClipboardList,
    FileBarChart2,
    ShieldCheck,
    Brain,
    Settings,
    Shield,
    Database,
    LogOut,
    Menu,
    X,
    UserCircle,
    Wrench,
    ChevronUp,
    CreditCard,
    Upload,
    Plug,
    Package,
    Factory,
    Gauge,
    FileCode,
    ListChecks,
    ClipboardCheck,
    Calendar,
    Search,
    AlertTriangle,
    BarChart3,
    DollarSign,
    GraduationCap,
    FolderOpen,
    Plane,
    TrendingUp,
    Scale,
    Download,
    Award,
    BookOpen,
} from "lucide-react";
import AppSidebarNav from "@/components/app/AppSidebarNav";
import SidebarProfilePanel from "@/components/app/SidebarProfilePanel";
import AIMechanicFAB from "@/components/ai/AIMechanicFAB";
import AIMechanicPanel from "@/components/ai/AIMechanicPanel";
import { useAuth } from "@/lib/AuthContext";
import { isAdminRole, resolveSessionRole } from "@/lib/auth/roles";
import { useSessionTimeout, SessionTimeoutWarning, clearSessionData } from "@/lib/SessionTimeout";
import { useEntitlements } from "@/lib/useEntitlements";
import { useAircraft } from "@/lib/AircraftContext";

const ALL_NAV_ITEMS = [
    { href: "/app/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { href: "/app/docs", label: "Documentation", icon: <FileText className="h-5 w-5" /> },
    { href: "/app/alerts", label: "Predictive Alerts", icon: <Bell className="h-5 w-5" /> },
    { href: "/app/maintenance-intelligence", label: "Maintenance Intelligence", icon: <Wrench className="h-5 w-5" />, tall: true },
    { href: "/app/ingestion-contracts", label: "Ingestion Contracts", icon: <Database className="h-5 w-5" />, tall: true },
    { href: "/app/logs", label: "Maintenance Logs", icon: <ClipboardList className="h-5 w-5" /> },
    { href: "/app/reports", label: "Reports", icon: <FileBarChart2 className="h-5 w-5" /> },
    { href: "/app/compliance", label: "Regulatory Compliance", icon: <ShieldCheck className="h-5 w-5" />, tall: true },
    { href: "/app/insights", label: "AI Insights", icon: <Brain className="h-5 w-5" /> },
    { href: "/app/data-import", label: "Data Import", icon: <Upload className="h-5 w-5" />, adminOnly: true },
    { href: "/app/integrations", label: "Integrations", icon: <Plug className="h-5 w-5" />, adminOnly: true },
    // ── MRO Modules ──
    { href: "/app/inventory", label: "Parts Inventory", icon: <Package className="h-5 w-5" /> },
    { href: "/app/shop-visits", label: "Shop Visits", icon: <Factory className="h-5 w-5" /> },
    { href: "/app/tools", label: "Tools & Calibration", icon: <Gauge className="h-5 w-5" />, tall: true },
    { href: "/app/engineering-orders", label: "Engineering Orders", icon: <FileCode className="h-5 w-5" />, tall: true },
    { href: "/app/maintenance-programs", label: "Maintenance Programs", icon: <ListChecks className="h-5 w-5" />, tall: true },
    { href: "/app/job-cards", label: "Job Cards", icon: <ClipboardCheck className="h-5 w-5" /> },
    { href: "/app/maintenance-events", label: "Maintenance Events", icon: <Calendar className="h-5 w-5" />, tall: true },
    { href: "/app/findings", label: "Findings & NRCs", icon: <Search className="h-5 w-5" /> },
    { href: "/app/mel-deferrals", label: "MEL Deferrals", icon: <AlertTriangle className="h-5 w-5" /> },
    { href: "/app/reliability", label: "Reliability", icon: <BarChart3 className="h-5 w-5" /> },
    { href: "/app/work-orders", label: "Work Orders", icon: <ClipboardList className="h-5 w-5" /> },
    { href: "/app/aircraft", label: "Aircraft Fleet", icon: <Plane className="h-5 w-5" /> },
    { href: "/app/fleet-analytics", label: "Fleet Analytics", icon: <TrendingUp className="h-5 w-5" /> },
    { href: "/app/maintenance-calendar", label: "Maintenance Calendar", icon: <Calendar className="h-5 w-5" />, tall: true },
    { href: "/app/warranty", label: "Warranty Claims", icon: <DollarSign className="h-5 w-5" /> },
    { href: "/app/training", label: "Staff Training", icon: <GraduationCap className="h-5 w-5" /> },
    { href: "/app/staff-licenses", label: "License Management", icon: <Award className="h-5 w-5" />, tall: true },
    { href: "/app/document-control", label: "Document Control", icon: <FolderOpen className="h-5 w-5" />, tall: true },
    { href: "/app/notifications", label: "Notifications", icon: <Bell className="h-5 w-5" /> },
    { href: "/app/decision-events", label: "Decision Events", icon: <Scale className="h-5 w-5" />, tall: true },
    { href: "/app/data-export", label: "Data Export / GDPR", icon: <Download className="h-5 w-5" />, tall: true },
    { href: "/app/subscription-billing", label: "Billing", icon: <CreditCard className="h-5 w-5" /> },
    { href: "/user-guide", label: "User Guide", icon: <BookOpen className="h-5 w-5" /> },
    { href: "/app/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
    { href: "/app/admin-panel", label: "Admin Panel", icon: <Shield className="h-5 w-5" />, adminOnly: true },
];

type AppShellClientProps = {
    children: React.ReactNode;
};

export default function AppShellClient({ children }: AppShellClientProps) {
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [aiOpen, setAiOpen] = useState(false);

    // Close sidebar by default on mobile screens
    useLayoutEffect(() => {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSidebarVisible(false);
        }
    }, []);
    const [aiInitialQuery, setAiInitialQuery] = useState<string | undefined>(undefined);
    const [aiContext, setAiContext] = useState<string | undefined>(undefined);
    const [profileOpen, setProfileOpen] = useState(false);
    const [lockedModal, setLockedModal] = useState<{ label: string; reason?: string } | null>(null);
    const [profileDisplayName, setProfileDisplayName] = useState<string>(() => {
        if (typeof window === "undefined") return "";
        try {
            const cached = localStorage.getItem("skymaintain.profile");
            if (cached) return JSON.parse(cached).full_name || "";
        } catch { /* ignore */ }
        return "";
    });
    const [profileAvatar, setProfileAvatar] = useState<string>(() => {
        if (typeof window === "undefined") return "";
        try {
            const cached = localStorage.getItem("skymaintain.profile");
            if (cached) return JSON.parse(cached).avatar_url || "";
        } catch { /* ignore */ }
        return "";
    });
    const roleHints = useMemo(() => {
        if (typeof window === "undefined") {
            return {} as { role?: string; licenseCode?: string; email?: string };
        }
        return {
            role: window.localStorage.getItem("skymaintain.userRole") || undefined,
            licenseCode: window.localStorage.getItem("skymaintain.licenseCode") || undefined,
            email: window.localStorage.getItem("skymaintain.userEmail") || undefined,
        };
    }, []);
    const pathname = usePathname();
    const router = useRouter();
    const { logout, user } = useAuth();
    const { allAircraft } = useAircraft();
    const { entitlements, loading: entitlementsLoading } = useEntitlements();
    const [teamMembersUsed, setTeamMembersUsed] = useState<number | null>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Auto-fetch profile on mount to hydrate avatar & display name
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/profile");
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                if (data.avatar_url !== undefined) setProfileAvatar(data.avatar_url || "");
                if (data.full_name !== undefined) setProfileDisplayName(data.full_name || "");
                try {
                    localStorage.setItem("skymaintain.profile", JSON.stringify(data));
                } catch { /* quota exceeded — ignore */ }
            } catch { /* offline or route missing — keep cached values */ }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadTeamUsage() {
            try {
                const response = await fetch("/api/billing", {
                    method: "GET",
                    headers: { Accept: "application/json" },
                    cache: "no-store",
                });
                if (!response.ok) return;

                const payload = (await response.json()) as { teamMembers?: number };
                if (!cancelled && typeof payload.teamMembers === "number") {
                    setTeamMembersUsed(payload.teamMembers);
                }
            } catch {
                // Keep fallback display when unavailable.
            }
        }

        void loadTeamUsage();
        return () => {
            cancelled = true;
        };
    }, []);

    const planLabel = useMemo(() => {
        if (entitlementsLoading) return "Loading plan...";
        if (entitlements.tier === "enterprise") return "Enterprise";
        if (entitlements.tier === "professional") return "Professional";
        return "Starter";
    }, [entitlementsLoading, entitlements.tier]);

    const usageSummary = useMemo(() => {
        if (entitlementsLoading) {
            return {
                text: "Usage: loading...",
                aircraftOverLimit: false,
                teamOverLimit: false,
                hasOverLimit: false,
            };
        }

        const aircraftLimit = entitlements.limits.max_aircraft;
        const teamLimit = entitlements.limits.max_team_members;

        const aircraftUsed = allAircraft.length;
        const teamUsed = teamMembersUsed;

        const aircraftOverLimit = aircraftLimit != null && aircraftUsed > aircraftLimit;
        const teamOverLimit = teamLimit != null && typeof teamUsed === "number" && teamUsed > teamLimit;

        const aircraft = aircraftLimit == null ? `${aircraftUsed}/∞` : `${aircraftUsed}/${aircraftLimit}`;
        const team = teamLimit == null
            ? `${teamUsed ?? "?"}/∞`
            : `${teamUsed ?? "?"}/${teamLimit}`;
        const storage = entitlements.limits.max_storage_gb == null ? "∞" : `${entitlements.limits.max_storage_gb}GB`;

        return {
            text: `Usage: Aircraft ${aircraft} • Team ${team} • Storage ${storage}`,
            aircraftOverLimit,
            teamOverLimit,
            hasOverLimit: aircraftOverLimit || teamOverLimit,
        };
    }, [
        entitlementsLoading,
        allAircraft.length,
        teamMembersUsed,
        entitlements.limits.max_aircraft,
        entitlements.limits.max_team_members,
        entitlements.limits.max_storage_gb,
    ]);

    // Handle manual logout with session cleanup
    const handleLogout = useCallback(() => {
        clearSessionData();
        logout();
        router.push("/");
    }, [logout, router]);
    const navItems = useMemo(() => {
        const f = entitlements.features;

        const featureRules: Record<string, { allowed: boolean; lockedReason: string }> = {
            // ── Professional+ features ──
            "/app/insights": {
                allowed: f.ai_insights_reports,
                lockedReason: "AI Insights requires Professional or Enterprise plan.",
            },
            "/app/reports": {
                allowed: f.custom_compliance_reports,
                lockedReason: "Custom reports require Professional or Enterprise plan.",
            },
            "/app/compliance": {
                allowed: f.regulatory_compliance,
                lockedReason: "Regulatory Compliance requires Professional or Enterprise plan.",
            },
            "/app/ingestion-contracts": {
                allowed: f.api_ingestion_contracts,
                lockedReason: "API & Ingestion Contracts require Professional or Enterprise plan.",
            },
            "/app/maintenance-intelligence": {
                allowed: f.advanced_ai_insights,
                lockedReason: "Maintenance Intelligence requires Professional or Enterprise plan.",
            },
            "/app/reliability": {
                allowed: f.ai_insights_reports,
                lockedReason: "Reliability Analytics requires Professional or Enterprise plan.",
            },
            "/app/fleet-analytics": {
                allowed: f.ai_insights_reports,
                lockedReason: "Fleet Analytics requires Professional or Enterprise plan.",
            },
            "/app/decision-events": {
                allowed: f.advanced_ai_insights,
                lockedReason: "Decision Events requires Professional or Enterprise plan.",
            },
            // ── Enterprise-only features ──
            "/app/alerts": {
                allowed: f.predictive_alerts,
                lockedReason: "Predictive Alerts is an Enterprise-only feature.",
            },
            "/app/integrations": {
                allowed: f.custom_integrations,
                lockedReason: "Custom Integrations is an Enterprise-only feature.",
            },
        };

        const resolvedRole = resolveSessionRole({
            rawRole: user?.role || roleHints.role,
            licenseCode: roleHints.licenseCode,
            email: user?.email || roleHints.email,
        });
        const canAccessAdmin = isAdminRole(resolvedRole);
        const baseItems = ALL_NAV_ITEMS
            .filter((item) => !item.adminOnly || canAccessAdmin)
            .map((item) => {
                const href = item.href || "";
                const rule = featureRules[href];
                if (!rule) return item;

                return {
                    ...item,
                    disabled: !rule.allowed,
                    disabledReason: !rule.allowed ? rule.lockedReason : undefined,
                    badgeLabel: rule.allowed ? "Included" : "Locked",
                };
            });
        return [
            ...baseItems,
            { label: "Logout", icon: <LogOut className="h-5 w-5" />, onClick: handleLogout },
        ];
    }, [
        entitlements,
        user?.role,
        user?.email,
        roleHints.role,
        roleHints.licenseCode,
        roleHints.email,
        handleLogout,
    ]);

    // Session timeout management
    const { isWarningVisible, remainingSeconds, extendSession } = useSessionTimeout();

    // Listen for profile updates from the profile panel
    useEffect(() => {
        const handler = (event: Event) => {
            const detail = (event as CustomEvent<{ full_name?: string; avatar_url?: string }>).detail;
            if (detail && "full_name" in detail) setProfileDisplayName(detail.full_name || "");
            if (detail && "avatar_url" in detail) setProfileAvatar(detail.avatar_url || "");
        };
        window.addEventListener("profile:updated", handler);
        return () => window.removeEventListener("profile:updated", handler);
    }, []);

    // Scroll to top when route changes
    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.scrollTo({ top: 0, behavior: "instant" });
        }
        // Also scroll window to top for fallback
        window.scrollTo({ top: 0, behavior: "instant" });
    }, [pathname]);

    // Auto-close sidebar on navigation on mobile
    useLayoutEffect(() => {
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSidebarVisible(false);
        }
    }, [pathname]);

    useEffect(() => {
        const openHandler = (event: Event) => {
            const detail = (event as CustomEvent<{ query?: string; context?: string }>).detail;
            setAiInitialQuery(detail?.query);
            setAiContext(detail?.context);
            setAiOpen(true);
        };

        const legacyHandler = (event: Event) => {
            const detail = (event as CustomEvent<{ context?: string }>).detail;
            setAiInitialQuery(undefined);
            setAiContext(detail?.context);
            setAiOpen(true);
        };

        window.addEventListener("ai-mechanic:open", openHandler);
        window.addEventListener("openAIMechanic", legacyHandler);

        return () => {
            window.removeEventListener("ai-mechanic:open", openHandler);
            window.removeEventListener("openAIMechanic", legacyHandler);
        };
    }, []);

    useEffect(() => {
        const toggleSidebarHandler = () => {
            setSidebarVisible((prev) => !prev);
        };

        window.addEventListener("app-shell:toggle-sidebar", toggleSidebarHandler);
        return () => {
            window.removeEventListener("app-shell:toggle-sidebar", toggleSidebarHandler);
        };
    }, []);

    return (
        <div className="h-dvh overflow-hidden bg-white text-[#0a0a0a]">
            <div className="flex h-full">
                {/* Dark backdrop — mobile only, dismisses sidebar on tap */}
                {sidebarVisible && (
                    <div
                        className="fixed inset-0 z-10 bg-black/40 md:hidden"
                        onClick={() => setSidebarVisible(false)}
                        aria-hidden="true"
                    />
                )}
                {sidebarVisible && (
                    <aside className="fixed left-0 top-0 z-20 h-dvh w-64 shrink-0 flex flex-col border-r border-[#e5e7eb] bg-white">
                        <div className="border-b border-[#e5e7eb]">
                            <div className="px-6 pt-6 pb-[0.8px]">
                                <div className="flex items-center justify-between">
                                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                                        <div className="size-9 rounded-[10px] overflow-hidden shadow-lg">
                                            <img src="/brand/SkyMaintain_logo.png" alt="SkyMaintain" className="h-full w-full object-contain" />
                                        </div>
                                        <div>
                                            <div className="text-[18px] leading-7 text-[#0a0a0a]">SkyMaintain</div>
                                            <div className="text-[12px] leading-4 text-[#6a7282]">v1.0</div>
                                            <div className="mt-1 inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                                                Current Plan: {planLabel}
                                            </div>
                                            <div className={`mt-1 text-[10px] leading-4 ${usageSummary.hasOverLimit ? "text-red-600" : "text-slate-500"}`}>
                                                {usageSummary.text}
                                            </div>
                                            {usageSummary.hasOverLimit ? (
                                                <button
                                                    type="button"
                                                    onClick={(event) => {
                                                        event.preventDefault();
                                                        router.push("/app/subscription-billing");
                                                    }}
                                                    className="mt-1 inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
                                                >
                                                    Over limit · Upgrade
                                                </button>
                                            ) : null}
                                        </div>
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={() => setSidebarVisible(false)}
                                        className="h-8 w-9 rounded-[8px] flex items-center justify-center"
                                        aria-label="Collapse sidebar"
                                    >
                                        <X className="h-4 w-4 text-[#6a7282]" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            <AppSidebarNav
                                items={navItems}
                                onNavigate={() => {
                                    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
                                        setSidebarVisible(false);
                                    }
                                }}
                                onLockedClick={(item) => {
                                    setLockedModal({
                                        label: item.label,
                                        reason: item.disabledReason,
                                    });
                                }}
                            />
                        </div>

                        <div className="relative border-t border-[#e5e7eb]">
                            <button
                                onClick={() => setProfileOpen((prev) => !prev)}
                                className="w-full px-4 py-4 pb-8 text-left hover:bg-[#f9fafb] transition-colors cursor-pointer group"
                                aria-label="Edit profile"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-transparent group-hover:border-[#2563eb] transition-colors">
                                        {profileAvatar ? (
                                            <img src={profileAvatar} alt="Avatar" className="h-full w-full object-cover" />
                                        ) : (
                                            <UserCircle className="h-10 w-10 text-[#9ca3af]" />
                                        )}
                                    </div>
                                    <div className="overflow-hidden flex-1">
                                        <div className="truncate text-[14px] leading-5 text-[#0a0a0a]">
                                            {profileDisplayName || user?.displayName || user?.email?.split("@")[0] || "User"}
                                        </div>
                                        <div className="truncate text-[12px] leading-4 text-[#6a7282] capitalize">
                                            {(user?.role || roleHints.role || "User").replace(/_/g, " ")}
                                        </div>
                                    </div>
                                    <ChevronUp className={`h-4 w-4 text-[#9ca3af] shrink-0 transition-transform ${profileOpen ? "rotate-180" : ""}`} />
                                </div>
                            </button>

                            {/* Expandable profile edit panel */}
                            <SidebarProfilePanel
                                isOpen={profileOpen}
                                onClose={() => setProfileOpen(false)}
                                userEmail={user?.email}
                                userRole={user?.role || roleHints.role}
                            />
                        </div>
                    </aside>
                )}

                {/* Main content area - scrollable, with left margin when sidebar is visible */}
                <div
                    ref={contentRef}
                    className={`relative flex-1 overflow-y-auto bg-[#f9fafb] ${sidebarVisible ? "md:ml-64" : ""}`}
                    style={{ height: "100dvh" }}
                >
                    {!sidebarVisible && (
                        <button
                            type="button"
                            onClick={() => setSidebarVisible(true)}
                            className="fixed left-4 top-4 z-10 flex items-center gap-2 rounded-[10px] border border-[#e5e7eb] bg-white px-3 py-2 text-[12px] text-[#0a0a0a] shadow-sm"
                            aria-label="Open sidebar"
                        >
                            <Menu className="h-4 w-4" />
                            Menu
                        </button>
                    )}
                    <div
                        className="flex w-full items-start justify-center min-h-full"
                        style={{ background: "linear-gradient(143deg, #f3f4f6 0%, #e5e7eb 100%)" }}
                    >
                        <div className="w-full max-w-[907.2px] px-6 py-6">
                            {children}
                        </div>
                    </div>
                </div>
            </div>
            <AIMechanicFAB
                onClick={() => setAiOpen((prev) => !prev)}
            />
            <AIMechanicPanel
                isOpen={aiOpen}
                onClose={() => setAiOpen(false)}
                initialQuery={aiInitialQuery}
                context={aiContext}
            />
            {/* Session Timeout Warning Modal */}
            <SessionTimeoutWarning
                isVisible={isWarningVisible}
                remainingSeconds={remainingSeconds}
                onExtend={extendSession}
            />

            {lockedModal ? (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
                    onClick={() => setLockedModal(null)}
                >
                    <div
                        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="text-lg font-semibold text-slate-900">Feature Locked</div>
                        <p className="mt-2 text-sm text-slate-600">
                            {lockedModal.label} is not available on your current subscription.
                        </p>
                        {lockedModal.reason ? (
                            <p className="mt-2 text-sm text-slate-600">{lockedModal.reason}</p>
                        ) : null}
                        <div className="mt-5 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setLockedModal(null)}
                                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                            >
                                Close
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setLockedModal(null);
                                    router.push("/app/subscription-billing");
                                }}
                                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                            >
                                Upgrade Plan
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
