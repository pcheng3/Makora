"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BookOpen,
  Brain,
  Trash2,
  Plus,
  ToggleLeft,
  ToggleRight,
  Upload,
  Download,
  Pencil,
  Check,
  X,
  Filter,
  Cpu,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import type { Rule, GuidanceFile } from "@/lib/types";

type Tab = "rules" | "guidance" | "filters" | "provider";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("rules");
  const [rules, setRules] = useState<Rule[]>([]);
  const [guidance, setGuidance] = useState<GuidanceFile[]>([]);
  const [loading, setLoading] = useState(true);

  // New rule form
  const [newRuleType, setNewRuleType] = useState<"do" | "avoid">("avoid");
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleDesc, setNewRuleDesc] = useState("");
  const [showNewRule, setShowNewRule] = useState(false);

  // Edit rule
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Skip extensions
  const [skipExtensions, setSkipExtensions] = useState<string[]>([]);
  const [newExt, setNewExt] = useState("");

  // Provider settings
  const [providerType, setProviderType] = useState<"claude" | "foundry">("claude");
  const [foundryBaseUrl, setFoundryBaseUrl] = useState("");
  const [foundryModel, setFoundryModel] = useState("claude-opus-4-6");
  const [foundryToken, setFoundryToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);
  const [providerSaved, setProviderSaved] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<boolean | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Import/export
  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/rules").then((r) => r.json()),
      fetch("/api/guidance").then((r) => r.json()),
      fetch("/api/settings/skip-extensions").then((r) => r.json()),
      fetch("/api/settings/provider").then((r) => r.json()),
    ])
      .then(([rulesData, guidanceData, skipData, providerData]) => {
        setRules(rulesData.rules || []);
        setGuidance(guidanceData.files || []);
        setSkipExtensions(skipData.extensions || []);
        setProviderType(providerData.provider || "claude");
        setFoundryBaseUrl(providerData.baseUrl || "");
        setFoundryModel(providerData.model || "claude-opus-4-6");
        setHasToken(providerData.hasToken || false);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteRule = async (id: number) => {
    await fetch(`/api/rules/${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggleRule = async (id: number, enabled: boolean) => {
    await fetch(`/api/rules/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled } : r))
    );
  };

  const handleAddRule = async () => {
    if (!newRuleTitle || !newRuleDesc) return;
    const res = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ruleType: newRuleType,
        title: newRuleTitle,
        description: newRuleDesc,
      }),
    });
    const data = await res.json();
    setRules((prev) => [
      {
        id: data.id,
        rule_type: newRuleType,
        category: null,
        title: newRuleTitle,
        description: newRuleDesc,
        source_type: "manual",
        confidence: 1.0,
        times_applied: 0,
        enabled: true,
        source_ratings: null,
        file_extensions: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setNewRuleTitle("");
    setNewRuleDesc("");
    setShowNewRule(false);
  };

  const startEditRule = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setEditTitle(rule.title);
    setEditDesc(rule.description);
  };

  const cancelEditRule = () => {
    setEditingRuleId(null);
    setEditTitle("");
    setEditDesc("");
  };

  const saveEditRule = async () => {
    if (!editingRuleId || !editTitle || !editDesc) return;
    await fetch(`/api/rules/${editingRuleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, description: editDesc }),
    });
    setRules((prev) =>
      prev.map((r) =>
        r.id === editingRuleId ? { ...r, title: editTitle, description: editDesc } : r
      )
    );
    cancelEditRule();
  };

  const [dragging, setDragging] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/guidance", { method: "POST", body: formData });
    const data = await res.json();
    setGuidance((prev) => [
      {
        id: data.id,
        filename: file.name,
        original_name: file.name,
        description: null,
        file_path: "",
        content_hash: null,
        size_bytes: file.size,
        enabled: true,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  }, []);

  const handleUploadGuidance = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingCount(files.length);
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
    setUploadingCount(0);
    e.target.value = "";
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      /\.(md|txt|json|ya?ml)$/i.test(f.name)
    );
    if (files.length === 0) return;
    setUploadingCount(files.length);
    for (const file of files) {
      await uploadFile(file);
    }
    setUploadingCount(0);
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragging(false);
  }, []);

  const handleExportRules = async () => {
    const res = await fetch("/api/rules/export");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "makora-rules.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportRules = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const res = await fetch("/api/rules/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.error) {
        setImportStatus(`Error: ${result.error}`);
      } else {
        setImportStatus(`Imported ${result.imported} rules, skipped ${result.skipped} duplicates`);
        const fresh = await fetch("/api/rules").then((r) => r.json());
        setRules(fresh.rules || []);
      }
    } catch {
      setImportStatus("Failed to parse file");
    }
    e.target.value = "";
    setTimeout(() => setImportStatus(""), 5000);
  };

  const handleAddExtension = async () => {
    let ext = newExt.trim().toLowerCase();
    if (!ext) return;
    if (!ext.startsWith(".")) ext = "." + ext;
    if (skipExtensions.includes(ext)) {
      setNewExt("");
      return;
    }
    const updated = [...skipExtensions, ext];
    await fetch("/api/settings/skip-extensions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extensions: updated }),
    });
    setSkipExtensions(updated);
    setNewExt("");
  };

  const handleRemoveExtension = async (ext: string) => {
    const updated = skipExtensions.filter((e) => e !== ext);
    await fetch("/api/settings/skip-extensions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extensions: updated }),
    });
    setSkipExtensions(updated);
  };

  const handleDeleteGuidance = async (id: number) => {
    await fetch(`/api/guidance?id=${id}`, { method: "DELETE" });
    setGuidance((prev) => prev.filter((g) => g.id !== id));
  };

  const handleToggleGuidance = async (id: number, enabled: boolean) => {
    await fetch("/api/guidance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled }),
    });
    setGuidance((prev) =>
      prev.map((g) => (g.id === id ? { ...g, enabled } : g))
    );
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--card-border)]">
        <button
          onClick={() => setTab("rules")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "rules"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Brain className="w-4 h-4" />
          Learned Rules ({rules.length})
        </button>
        <button
          onClick={() => setTab("guidance")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "guidance"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Guidance Files ({guidance.length})
        </button>
        <button
          onClick={() => setTab("filters")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "filters"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Filter className="w-4 h-4" />
          File Filters
        </button>
        <button
          onClick={() => setTab("provider")}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "provider"
              ? "border-[var(--accent)] text-[var(--accent)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <Cpu className="w-4 h-4" />
          AI Provider
        </button>
      </div>

      {/* Rules tab */}
      {tab === "rules" && (
        <div>
          <p className="text-sm text-[var(--muted)] mb-3">
            Rules learned from your review ratings. They&apos;re injected into future review prompts.
          </p>
          <div className="flex items-center gap-1.5 mb-4">
            <button
              onClick={() => setShowNewRule(!showNewRule)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)]"
            >
              <Plus className="w-3 h-3" />
              Add Rule
            </button>
            <button
              onClick={handleExportRules}
              className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md border-[var(--card-border)] hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Download className="w-3 h-3" />
              Export
            </button>
            <label className="flex items-center gap-1 px-3 py-1.5 text-xs border rounded-md border-[var(--card-border)] hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
              <Upload className="w-3 h-3" />
              Import
              <input
                type="file"
                onChange={handleImportRules}
                className="hidden"
                accept=".json"
              />
            </label>
          </div>

          {importStatus && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
              {importStatus}
            </div>
          )}

          {showNewRule && (
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4 mb-4 space-y-3">
              <div className="flex gap-2">
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as "do" | "avoid")}
                  className="px-3 py-1.5 text-sm border rounded bg-[var(--card-bg)] border-[var(--card-border)]"
                >
                  <option value="avoid">Avoid</option>
                  <option value="do">Do</option>
                </select>
                <input
                  type="text"
                  value={newRuleTitle}
                  onChange={(e) => setNewRuleTitle(e.target.value)}
                  placeholder="Rule title"
                  className="flex-1 px-3 py-1.5 text-sm border rounded bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                />
              </div>
              <textarea
                value={newRuleDesc}
                onChange={(e) => setNewRuleDesc(e.target.value)}
                placeholder="Rule description (this exact text is injected into the review prompt)"
                rows={2}
                className="w-full px-3 py-1.5 text-sm border rounded bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddRule}
                  disabled={!newRuleTitle || !newRuleDesc}
                  className="px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50"
                >
                  Save Rule
                </button>
                <button
                  onClick={() => setShowNewRule(false)}
                  className="px-3 py-1.5 text-xs border rounded-md border-[var(--card-border)] hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {rules.length === 0 ? (
            <p className="text-[var(--muted)] text-sm py-8 text-center">
              No rules yet. Rate review items to start building rules, or add them manually.
            </p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`bg-[var(--card-bg)] border rounded-lg p-4 ${
                    rule.enabled
                      ? "border-[var(--card-border)]"
                      : "border-[var(--card-border)] opacity-50"
                  }`}
                >
                  {editingRuleId === rule.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                            rule.rule_type === "do"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {rule.rule_type}
                        </span>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="flex-1 px-2 py-1 text-sm font-semibold border rounded bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                        />
                      </div>
                      <textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        rows={2}
                        className="w-full px-2 py-1 text-sm border rounded bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                      />
                      <div className="flex gap-1">
                        <button
                          onClick={saveEditRule}
                          disabled={!editTitle || !editDesc}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)] disabled:opacity-50"
                        >
                          <Check className="w-3 h-3" />
                          Save
                        </button>
                        <button
                          onClick={cancelEditRule}
                          className="flex items-center gap-1 px-2 py-1 text-xs border rounded border-[var(--card-border)] hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                          <X className="w-3 h-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              rule.rule_type === "do"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                          >
                            {rule.rule_type}
                          </span>
                          <span className="text-sm font-semibold">{rule.title}</span>
                          <span className="text-xs text-[var(--muted)]">
                            ({rule.source_type} | conf: {(rule.confidence * 100).toFixed(0)}% | used {rule.times_applied}x)
                          </span>
                        </div>
                        <p className="text-sm text-[var(--muted)]">{rule.description}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditRule(rule)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-[var(--muted)] hover:text-[var(--foreground)]"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleRule(rule.id, !rule.enabled)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                          title={rule.enabled ? "Disable" : "Enable"}
                        >
                          {rule.enabled ? (
                            <ToggleRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-400" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* File Filters tab */}
      {tab === "filters" && (
        <div>
          <p className="text-sm text-[var(--muted)] mb-4">
            Files with these extensions are skipped during reviews. Add or remove extensions to control what gets reviewed.
          </p>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newExt}
              onChange={(e) => setNewExt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddExtension();
              }}
              placeholder=".ext"
              className="px-3 py-1.5 text-sm border rounded bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 w-32"
            />
            <button
              onClick={handleAddExtension}
              disabled={!newExt.trim()}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>

          {skipExtensions.length === 0 ? (
            <p className="text-[var(--muted)] text-sm py-8 text-center">
              No extensions are being skipped. All file types will be reviewed.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skipExtensions.map((ext) => (
                <span
                  key={ext}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-[var(--card-bg)] border border-[var(--card-border)] rounded-full"
                >
                  <span className="font-mono">{ext}</span>
                  <button
                    onClick={() => handleRemoveExtension(ext)}
                    className="ml-0.5 p-0.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--muted)] hover:text-red-500 transition-colors"
                    title={`Remove ${ext}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Provider tab */}
      {tab === "provider" && (
        <div className="space-y-6">
          <p className="text-sm text-[var(--muted)]">
            Choose between local Claude CLI or a Vertex-compatible API endpoint for running reviews.
          </p>

          <div className="space-y-3">
            <label
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                providerType === "claude"
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--accent)]/50"
              }`}
              onClick={() => setProviderType("claude")}
            >
              <input
                type="radio"
                name="provider"
                checked={providerType === "claude"}
                onChange={() => setProviderType("claude")}
                className="mt-1 accent-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-semibold">Claude CLI (Local)</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Uses the local <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">claude</code> command.
                  Agentic mode — can explore repo files, run git commands, and read surrounding code for deeper analysis.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                providerType === "foundry"
                  ? "border-[var(--accent)] bg-[var(--accent)]/5"
                  : "border-[var(--card-border)] bg-[var(--card-bg)] hover:border-[var(--accent)]/50"
              }`}
              onClick={() => setProviderType("foundry")}
            >
              <input
                type="radio"
                name="provider"
                checked={providerType === "foundry"}
                onChange={() => setProviderType("foundry")}
                className="mt-1 accent-[var(--accent)]"
              />
              <div>
                <p className="text-sm font-semibold">Vertex API (Scapula / Foundry)</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  Direct API calls via a Vertex-compatible endpoint. Faster but reviews the diff as-is without repo exploration.
                </p>
              </div>
            </label>
          </div>

          {providerType === "foundry" && (
            <div className="bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vertex Base URL</label>
                <input
                  type="text"
                  value={foundryBaseUrl}
                  onChange={(e) => setFoundryBaseUrl(e.target.value)}
                  placeholder="https://production.scapula.rubix.cloud/llm-portal/vertex/v1"
                  className="w-full px-3 py-2 text-sm font-mono border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Vertex-compatible endpoint. Falls back to <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">ANTHROPIC_VERTEX_BASE_URL</code> env var.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Model</label>
                <input
                  type="text"
                  value={foundryModel}
                  onChange={(e) => setFoundryModel(e.target.value)}
                  placeholder="claude-opus-4-6"
                  className="w-full px-3 py-2 text-sm border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Auth Token
                  {hasToken && !foundryToken && (
                    <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-400">
                      <CheckCircle className="inline w-3 h-3 mr-0.5" />
                      saved
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={foundryToken}
                  onChange={(e) => setFoundryToken(e.target.value)}
                  placeholder={hasToken ? "Token saved — enter new value to replace" : "Paste your Scapula auth token"}
                  className="w-full px-3 py-2 text-sm border rounded-md bg-[var(--card-bg)] border-[var(--card-border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
                />
                <p className="text-xs text-[var(--muted)] mt-1">
                  Stored locally in the database (gitignored). Falls back to <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">ANTHROPIC_AUTH_TOKEN</code> env var.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                setProviderSaving(true);
                try {
                  await fetch("/api/settings/provider", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      provider: providerType,
                      baseUrl: foundryBaseUrl,
                      model: foundryModel,
                      ...(foundryToken ? { token: foundryToken } : {}),
                    }),
                  });
                  if (foundryToken) {
                    setHasToken(true);
                    setFoundryToken("");
                  }
                  setProviderSaved(true);
                  setTimeout(() => setProviderSaved(false), 2000);
                } finally {
                  setProviderSaving(false);
                }
              }}
              disabled={providerSaving}
              className="flex items-center gap-1 px-4 py-2 text-sm bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {providerSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : providerSaved ? (
                <Check className="w-4 h-4" />
              ) : null}
              {providerSaved ? "Saved!" : "Save"}
            </button>

            {providerType === "foundry" && (
              <button
                onClick={async () => {
                  setTestingConnection(true);
                  setConnectionResult(null);
                  setConnectionError(null);
                  try {
                    await fetch("/api/settings/provider", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        provider: providerType,
                        baseUrl: foundryBaseUrl,
                        model: foundryModel,
                        ...(foundryToken ? { token: foundryToken } : {}),
                      }),
                    });
                    if (foundryToken) {
                      setHasToken(true);
                      setFoundryToken("");
                    }
                    const res = await fetch("/api/settings/provider", { method: "POST" });
                    const data = await res.json();
                    setConnectionResult(data.available);
                    setConnectionError(data.error || null);
                  } catch {
                    setConnectionResult(false);
                  } finally {
                    setTestingConnection(false);
                  }
                }}
                disabled={testingConnection}
                className="flex items-center gap-1 px-4 py-2 text-sm border border-[var(--card-border)] rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
              >
                {testingConnection ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Test Connection
              </button>
            )}

            {connectionResult !== null && (
              <span className={`flex items-center gap-1 text-sm ${connectionResult ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                {connectionResult ? (
                  <><CheckCircle className="w-4 h-4" /> Connected</>
                ) : (
                  <><XCircle className="w-4 h-4" /> Failed</>
                )}
              </span>
            )}
            {connectionError && !connectionResult && (
              <div className="w-full mt-2">
                <p className="text-xs text-red-500 font-mono break-all">{connectionError}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Guidance tab */}
      {tab === "guidance" && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-[var(--muted)]">
              Upload coding standards, anti-patterns, or CLAUDE.md files to guide reviews.
            </p>
            <label className="flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded-md hover:bg-[var(--accent-hover)] cursor-pointer">
              <Upload className="w-3 h-3" />
              Upload Files
              <input
                type="file"
                onChange={handleUploadGuidance}
                className="hidden"
                accept=".md,.txt,.json,.yaml,.yml"
                multiple
              />
            </label>
          </div>

          {uploadingCount > 0 && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
              <Upload className="w-4 h-4 animate-pulse" />
              Uploading {uploadingCount} file(s)...
            </div>
          )}

          {/* Drop zone overlay */}
          {dragging && (
            <div className="mb-4 border-2 border-dashed border-[var(--accent)] rounded-lg p-8 text-center bg-[var(--accent)]/5 transition-colors">
              <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--accent)]" />
              <p className="text-sm font-medium text-[var(--accent)]">Drop files here</p>
              <p className="text-xs text-[var(--muted)] mt-1">.md, .txt, .json, .yaml</p>
            </div>
          )}

          {guidance.length === 0 && !dragging ? (
            <label className="block border-2 border-dashed border-[var(--card-border)] rounded-lg p-8 text-center cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 transition-colors">
              <Upload className="w-8 h-8 mx-auto mb-2 text-[var(--muted)]" />
              <p className="text-sm text-[var(--muted)]">
                Drag & drop files here, or click to browse
              </p>
              <p className="text-xs text-[var(--muted)] mt-1">.md, .txt, .json, .yaml</p>
              <input
                type="file"
                onChange={handleUploadGuidance}
                className="hidden"
                accept=".md,.txt,.json,.yaml,.yml"
                multiple
              />
            </label>
          ) : (
            <div className="space-y-2">
              {guidance.map((g) => (
                <div
                  key={g.id}
                  className={`bg-[var(--card-bg)] border rounded-lg p-4 flex items-center justify-between ${
                    g.enabled
                      ? "border-[var(--card-border)]"
                      : "border-[var(--card-border)] opacity-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium">{g.original_name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {g.size_bytes ? `${(g.size_bytes / 1024).toFixed(1)} KB` : ""} | Added{" "}
                      {new Date(g.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleGuidance(g.id, !g.enabled)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {g.enabled ? (
                        <ToggleRight className="w-5 h-5 text-green-500" />
                      ) : (
                        <ToggleLeft className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDeleteGuidance(g.id)}
                      className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
