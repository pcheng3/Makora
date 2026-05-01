"use client";

import { useState, useEffect } from "react";
import {
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
} from "lucide-react";
import type { Rule } from "@/lib/types";

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  const [newRuleType, setNewRuleType] = useState<"do" | "avoid">("avoid");
  const [newRuleTitle, setNewRuleTitle] = useState("");
  const [newRuleDesc, setNewRuleDesc] = useState("");
  const [showNewRule, setShowNewRule] = useState(false);

  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const [importStatus, setImportStatus] = useState("");

  useEffect(() => {
    fetch("/api/rules")
      .then((r) => r.json())
      .then((data) => setRules(data.rules || []))
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

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Rules</h1>
        <p className="text-[var(--muted)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-6 h-6 text-purple-500" />
        <h1 className="text-2xl font-bold">Learned Rules</h1>
        <span className="text-sm text-[var(--muted)]">({rules.length})</span>
      </div>
      <p className="text-sm text-[var(--muted)] mb-6">
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
  );
}
