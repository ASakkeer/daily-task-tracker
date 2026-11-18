import React, { useState } from 'react';
import { AppMetadata, EodDigestConfig } from '../../types';
import {
  Send,
  Check,
  AlertCircle,
  Copy,
  Terminal,
  ExternalLink,
  MessageSquare,
  Sparkles,
  HelpCircle,
  Layers,
  ShieldAlert,
  Flame,
  CheckCircle2,
  Clock,
  Radio,
} from 'lucide-react';
import { generateDailyStandup, dispatchEodWebhook } from '../../services/aiService';
import { DEFAULT_EOD_DIGEST } from '../../db/seed';
import { CustomDropdown } from '../common/CustomDropdown';

interface EodDigestManagerProps {
  metadata: AppMetadata;
  onChange: (config: EodDigestConfig) => void;
}

type GuidePlatform = 'slack' | 'teams' | 'discord' | 'custom';

export const EodDigestManager: React.FC<EodDigestManagerProps> = ({ metadata, onChange }) => {
  const config = metadata.eodDigest || DEFAULT_EOD_DIGEST;

  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl || '');
  const [channelName, setChannelName] = useState(config.channelName || '#daily-standup');
  const [format, setFormat] = useState<'markdown' | 'compact' | 'json'>(config.format || 'markdown');
  const [enabled, setEnabled] = useState(config.enabled ?? false);
  const [autoDispatchOnSlotClose, setAutoDispatchOnSlotClose] = useState(config.autoDispatchOnSlotClose ?? false);

  const [activeGuideTab, setActiveGuideTab] = useState<GuidePlatform>('slack');
  const [previewTab, setPreviewTab] = useState<'visual' | 'code'>('visual');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [copiedPreview, setCopiedPreview] = useState(false);

  // Generate sample preview based on active metadata
  const sampleReport = {
    id: 'sample_today_EVENING',
    date: new Date().toISOString().split('T')[0],
    slot: 'EVENING' as const,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tasks: [
      {
        id: 'sample_1',
        sectionId: metadata.sections[0]?.id || 'sec_main',
        order: 1,
        category: 'Authentication & Session Token Lifecycle Test Matrix',
        completionPct: 100,
        confidencePct: 100,
        ownerIds: metadata.owners.slice(0, 1).map((o) => o.id),
        etaDate: new Date().toISOString().split('T')[0],
        statusId: metadata.statuses.find((s) => s.isCompletedState)?.id || metadata.statuses[0]?.id,
        notes: 'Verification complete: all staging suites green',
        highlightNotesBold: false,
      },
      {
        id: 'sample_2',
        sectionId: metadata.sections[0]?.id || 'sec_main',
        order: 2,
        category: 'Checkout Webhooks & Payment Gateway Idempotency',
        completionPct: 75,
        confidencePct: 80,
        ownerIds: metadata.owners.slice(1, 2).map((o) => o.id),
        etaDate: new Date().toISOString().split('T')[0],
        statusId: metadata.statuses.find((s) => s.label.toLowerCase().includes('progress'))?.id || metadata.statuses[1]?.id,
        notes: 'Executing edge cases for refund webhooks',
        highlightNotesBold: false,
      },
      {
        id: 'sample_3',
        sectionId: metadata.sections[1]?.id || metadata.sections[0]?.id || 'sec_main',
        order: 3,
        category: 'Partner API Rate Limiting & Retry Backoff Suite',
        completionPct: 40,
        confidencePct: 50,
        ownerIds: metadata.owners.slice(2, 3).map((o) => o.id),
        etaDate: new Date().toISOString().split('T')[0],
        statusId: metadata.statuses.find((s) => s.label.toLowerCase().includes('blocked') || s.label.toLowerCase().includes('wait'))?.id || metadata.statuses[2]?.id,
        notes: 'BLOCKED: Waiting on upstream sandbox token generation',
        highlightNotesBold: true,
      },
    ],
  };

  const sampleStandup = generateDailyStandup(sampleReport, metadata);

  const handleSave = (updates: Partial<EodDigestConfig>) => {
    const nextConfig: EodDigestConfig = {
      enabled,
      webhookUrl,
      channelName,
      format,
      autoDispatchOnSlotClose,
      ...updates,
    };
    onChange(nextConfig);
  };

  const handleTestDispatch = async () => {
    if (!webhookUrl.trim()) {
      setTestResult({
        success: false,
        message: 'Please provide a valid Incoming Webhook URL before testing.',
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const res = await dispatchEodWebhook(sampleReport, metadata, webhookUrl, format);
    setTesting(false);
    setTestResult(res);

    if (res.success) {
      handleSave({ lastDispatchedAt: new Date().toISOString() });
    }
  };

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(sampleStandup.markdown);
      setCopiedPreview(true);
      setTimeout(() => setCopiedPreview(false), 2000);
    } catch {
      // fallback
    }
  };

  // Detect platform by URL
  const detectedPlatform = webhookUrl.includes('slack.com')
    ? 'Slack'
    : webhookUrl.includes('office.com') || webhookUrl.includes('webhook.office')
    ? 'Microsoft Teams'
    : webhookUrl.includes('discord.com')
    ? 'Discord'
    : webhookUrl.trim()
    ? 'Custom Webhook'
    : null;

  return (
    <div className="space-y-6">
      {/* Educational Purpose Card */}
      <div className="bg-white dark:bg-[#050c21] p-6 rounded-2xl border border-slate-200 dark:border-[#142552] shadow-sm dark:shadow-xl transition-colors space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-100 dark:bg-[#ff2d5f]/20 text-rose-900 dark:text-[#ff2d5f]">
                <Send className="w-4 h-4" />
              </span>
              <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-wider">
                What is the End-of-Day (EOD) Digest?
              </h2>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-3xl pt-1">
              At the end of every working day, engineering &amp; QA teams spend 15–20 minutes manually re-typing what was done, what is ongoing, and who is blocked into chat channels.
              <strong> The EOD Digest eliminates this manual typing completely.</strong> With 1 click (or automated prompt), Task Studio aggregates today's active table into an executive summary card and pushes it straight to your team&apos;s Slack channel, Microsoft Teams chat, or Discord server.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              disabled={testing}
              onClick={handleTestDispatch}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#ff2d5f] hover:bg-[#e62252] text-white rounded-xl text-xs font-black transition-all shadow-md shadow-[#ff2d5f]/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
              {testing ? 'Dispatching Test...' : 'Send Test Notification'}
            </button>
          </div>
        </div>

        {/* 3 Key Value Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] space-y-1">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Zero-Effort Standup Sync</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Never copy-paste rows again. Completed tasks, confidence levels, and active ETAs format cleanly into Markdown.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] space-y-1">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Instant Blocker Visibility</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Blockers, dependencies, and overdue deliverables are surfaced prominently at the top of the message for quick escalation.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] space-y-1">
            <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-200">
              <Radio className="w-4 h-4 text-[#ff2d5f]" />
              <span>Works Anywhere (No Bot Install)</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
              Uses standard Incoming Webhooks. No administrative OAuth permissions or custom bot installs needed.
            </p>
          </div>
        </div>
      </div>

      {/* Test Feedback Toast / Alert */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border text-xs font-bold flex items-center justify-between animate-in fade-in ${
            testResult.success
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800/60 text-rose-900 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {testResult.success ? (
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
            <span>{testResult.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="text-[11px] underline opacity-80 hover:opacity-100 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 60-Second Setup Guide (Tabs for Slack, Teams, Discord, Custom) */}
      <div className="bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="p-4 bg-slate-50 dark:bg-[#020612]/70 border-b border-slate-200 dark:border-[#142552] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-[#ff2d5f]" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
              How to obtain your Webhook URL in 30 Seconds
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-[#050c21] p-1 rounded-xl border border-slate-200 dark:border-[#142552]">
            {(['slack', 'teams', 'discord', 'custom'] as GuidePlatform[]).map((plat) => (
              <button
                key={plat}
                type="button"
                onClick={() => setActiveGuideTab(plat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all capitalize cursor-pointer ${
                  activeGuideTab === plat
                    ? 'bg-[#ff2d5f] text-white font-black shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {plat === 'slack'
                  ? 'Slack'
                  : plat === 'teams'
                  ? 'MS Teams'
                  : plat === 'discord'
                  ? 'Discord'
                  : 'Custom API'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed space-y-3">
          {activeGuideTab === 'slack' && (
            <div className="space-y-2">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Connecting to Slack via Incoming Webhooks:</span>
              </div>
              <ol className="list-decimal list-inside pl-2 space-y-1 text-slate-600 dark:text-slate-400 font-medium">
                <li>Go to <strong className="text-slate-800 dark:text-slate-200">api.slack.com/apps</strong> or search your workspace for the &ldquo;Incoming WebHooks&rdquo; app.</li>
                <li>Click <strong className="text-slate-800 dark:text-slate-200">Add to Slack</strong> and choose the channel where you want daily reports posted (e.g. <code className="font-mono text-rose-600 dark:text-[#ff2d5f]">#daily-qa-standup</code>).</li>
                <li>Copy the generated Webhook URL (format: <code className="font-mono text-rose-600 dark:text-[#ff2d5f]">https://hooks.slack.com/services/T.../B.../X...</code>).</li>
                <li>Paste it in the Webhook URL field below and click &ldquo;Send Test Notification&rdquo;.</li>
              </ol>
            </div>
          )}

          {activeGuideTab === 'teams' && (
            <div className="space-y-2">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Connecting to Microsoft Teams via Workflows / Power Automate:</span>
              </div>
              <ol className="list-decimal list-inside pl-2 space-y-1 text-slate-600 dark:text-slate-400 font-medium">
                <li>In your Teams channel, click the <strong className="text-slate-800 dark:text-slate-200">&bull;&bull;&bull; (More options)</strong> icon and select <strong className="text-slate-800 dark:text-slate-200">Workflows</strong>.</li>
                <li>Search for the template <strong className="text-slate-800 dark:text-slate-200">&ldquo;Post to a channel when a webhook request is received&rdquo;</strong>.</li>
                <li>Follow the wizard and copy the generated HTTP POST URL.</li>
                <li>Paste it below and set Payload Format to <strong className="text-slate-800 dark:text-slate-200">Rich Markdown</strong>.</li>
              </ol>
            </div>
          )}

          {activeGuideTab === 'discord' && (
            <div className="space-y-2">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Connecting to Discord Server:</span>
              </div>
              <ol className="list-decimal list-inside pl-2 space-y-1 text-slate-600 dark:text-slate-400 font-medium">
                <li>Right-click your text channel in Discord &gt; <strong className="text-slate-800 dark:text-slate-200">Edit Channel</strong> &gt; <strong className="text-slate-800 dark:text-slate-200">Integrations</strong>.</li>
                <li>Click <strong className="text-slate-800 dark:text-slate-200">Webhooks</strong> &gt; <strong className="text-slate-800 dark:text-slate-200">New Webhook</strong>.</li>
                <li>Name the webhook <strong className="text-slate-800 dark:text-slate-200">Task Studio Daily Bot</strong> and click <strong className="text-slate-800 dark:text-slate-200">Copy Webhook URL</strong>.</li>
                <li>Paste it below. Discord natively formats Markdown text with bold, bullet points, and code blocks.</li>
              </ol>
            </div>
          )}

          {activeGuideTab === 'custom' && (
            <div className="space-y-2">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px]">1</span>
                <span>Custom API Endpoint or Automation Middleware (Zapier, Make, n8n):</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                You can route the digest to any REST API endpoint. Choose <strong className="text-slate-800 dark:text-slate-200">Raw JSON</strong> format below to receive complete task objects, completion percentages, owner names, status IDs, and computed overdue metrics in the POST request body.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Configuration Form Card */}
      <div className="bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] p-5 shadow-sm dark:shadow-xl space-y-5 transition-colors">
        {/* Toggle Switch */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-[#142552]/50">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                EOD Webhook Integration Active
              </h4>
              {enabled ? (
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60">
                  Ready to Dispatch
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Disabled
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
              When enabled, a one-click &ldquo;Dispatch EOD Standup&rdquo; button appears directly on your daily report toolbar.
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                setEnabled(e.target.checked);
                handleSave({ enabled: e.target.checked });
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-[#ff2d5f]"></div>
          </label>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          {/* Webhook URL with platform detection */}
          <div className="md:col-span-8 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Incoming Webhook URL
              </label>
              {detectedPlatform && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-[#ff2d5f]/20 text-rose-900 dark:text-[#ff2d5f] border border-rose-200 dark:border-[#ff2d5f]/30">
                  Detected: {detectedPlatform}
                </span>
              )}
            </div>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => {
                setWebhookUrl(e.target.value);
                handleSave({ webhookUrl: e.target.value });
              }}
              placeholder="https://hooks.slack.com/services/... or Teams / Discord URL"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-mono text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          {/* Channel Name */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Channel / Recipient Name
            </label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => {
                setChannelName(e.target.value);
                handleSave({ channelName: e.target.value });
              }}
              placeholder="#daily-qa-standup"
              className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#020612] border border-slate-300 dark:border-[#142552] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#ff2d5f] font-semibold text-slate-800 dark:text-slate-100 placeholder-slate-400"
            />
          </div>

          {/* Payload Format */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Dispatch Payload Format
            </label>
            <CustomDropdown
              value={format}
              onChange={(val) => {
                const f = val as 'markdown' | 'compact' | 'json';
                setFormat(f);
                handleSave({ format: f });
              }}
              options={[
                { value: 'markdown', label: 'Rich Markdown (Slack, Teams, Discord)' },
                { value: 'compact', label: 'Compact Single-Paragraph Summary' },
                { value: 'json', label: 'Raw JSON (REST Webhook Integrations)' },
              ]}
              className="w-full text-xs"
              buttonClassName="py-2 px-3 text-xs font-semibold"
            />
          </div>

          {/* Prompt on Evening Slot */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Evening Slot Workflow Prompt
            </label>
            <label className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] rounded-lg cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={autoDispatchOnSlotClose}
                onChange={(e) => {
                  setAutoDispatchOnSlotClose(e.target.checked);
                  handleSave({ autoDispatchOnSlotClose: e.target.checked });
                }}
                className="w-4 h-4 text-[#ff2d5f] rounded border-slate-300 dark:border-slate-700 focus:ring-[#ff2d5f]"
              />
              <span>Prompt to dispatch webhook when closing or viewing Evening slot</span>
            </label>
          </div>
        </div>

        {config.lastDispatchedAt && (
          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-1">
            <Sparkles className="w-3.5 h-3.5 text-[#ff2d5f]" />
            <span>
              Last successful webhook dispatch:{' '}
              <strong className="text-slate-800 dark:text-slate-200 font-mono">
                {new Date(config.lastDispatchedAt).toLocaleString()}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Realistic Simulated Message Card vs Raw Payload Preview */}
      <div className="bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] overflow-hidden shadow-sm dark:shadow-xl transition-colors">
        <div className="p-4 bg-slate-50 dark:bg-[#020612]/70 border-b border-slate-200 dark:border-[#142552] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
            <MessageSquare className="w-3.5 h-3.5 text-[#ff2d5f]" />
            <span>Live Message Card Preview</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white dark:bg-[#050c21] p-0.5 rounded-lg border border-slate-200 dark:border-[#142552]">
              <button
                type="button"
                onClick={() => setPreviewTab('visual')}
                className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer ${
                  previewTab === 'visual'
                    ? 'bg-[#ff2d5f] text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Simulated Chat Card
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('code')}
                className={`px-2.5 py-1 text-xs font-bold rounded cursor-pointer ${
                  previewTab === 'code'
                    ? 'bg-[#ff2d5f] text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Raw Payload ({format.toUpperCase()})
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyPreview}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded text-xs font-bold transition-colors cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{copiedPreview ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        {previewTab === 'visual' ? (
          <div className="p-6 bg-slate-100 dark:bg-[#020612]/90 flex justify-center">
            {/* Mock Slack/Teams Message Card */}
            <div className="w-full max-w-2xl bg-white dark:bg-[#050c21] rounded-2xl border border-slate-200 dark:border-[#142552] p-5 shadow-lg space-y-4 font-sans">
              {/* Bot Header */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#ff2d5f] to-rose-700 flex items-center justify-center text-white font-black text-sm shadow-md shadow-[#ff2d5f]/20">
                  TS
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      Task Studio Daily Bot
                    </span>
                    <span className="text-[10px] bg-rose-100 dark:bg-[#ff2d5f]/20 text-rose-900 dark:text-[#ff2d5f] font-bold px-1.5 py-0.2 rounded">
                      APP
                    </span>
                    <span className="text-[11px] text-slate-400">Today at 6:30 PM</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    posted to <strong className="font-semibold text-slate-700 dark:text-slate-300">{channelName}</strong>
                  </span>
                </div>
              </div>

              {/* Card Title & Date */}
              <div className="border-l-4 border-[#ff2d5f] pl-3 py-1 space-y-1">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  📋 Daily Engineering &amp; QA EOD Standup Digest
                </h4>
                <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <span>📅 Date: <strong className="text-slate-800 dark:text-slate-200">{sampleReport.date}</strong></span>
                  <span>&bull;</span>
                  <span>Slot: <strong className="text-[#ff2d5f]">{sampleReport.slot}</strong></span>
                </div>
              </div>

              {/* Executive Stat Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#08122f] border border-slate-200 dark:border-[#142552] text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-bold">Total Tasks</div>
                  <div className="text-base font-black text-slate-900 dark:text-white">
                    {sampleStandup.stats.totalTasks}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-center">
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-bold">Completed</div>
                  <div className="text-base font-black text-emerald-800 dark:text-emerald-300">
                    {sampleStandup.stats.completedTasks}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-center">
                  <div className="text-[10px] text-amber-700 dark:text-amber-400 uppercase font-bold">In Progress</div>
                  <div className="text-base font-black text-amber-800 dark:text-amber-300">
                    {Math.max(0, sampleStandup.stats.totalTasks - sampleStandup.stats.completedTasks)}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-center">
                  <div className="text-[10px] text-rose-700 dark:text-rose-400 uppercase font-bold">Blockers</div>
                  <div className="text-base font-black text-rose-800 dark:text-rose-300">
                    {sampleStandup.stats.activeBlockers}
                  </div>
                </div>
              </div>

              {/* Tasks List */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-[#142552]/60 text-xs">
                {sampleReport.tasks.map((task) => {
                  const status = metadata.statuses.find((s) => s.id === task.statusId);
                  const owner = metadata.owners.find((o) => o.id === task.ownerIds[0]);
                  return (
                    <div
                      key={task.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#020612] border border-slate-200 dark:border-[#142552] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{task.category}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {task.notes}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold border"
                          style={{
                            backgroundColor: status?.bgColor,
                            color: status?.textColor,
                          }}
                        >
                          {status?.label}
                        </span>
                        <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                          {task.completionPct}%
                        </span>
                        <span className="text-[11px] font-semibold text-slate-500">
                          ({owner?.name || 'Assigned'})
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#020612] font-mono text-xs text-slate-200 overflow-x-auto max-h-72 leading-relaxed">
            {format === 'json' ? (
              <pre>
                {JSON.stringify(
                  {
                    event: 'daily_report_digest',
                    reportId: sampleReport.id,
                    channel: channelName,
                    stats: sampleStandup.stats,
                    tasksCount: sampleReport.tasks.length,
                    tasks: sampleReport.tasks,
                  },
                  null,
                  2
                )}
              </pre>
            ) : format === 'compact' ? (
              <p>
                *📋 Standup ({sampleReport.date} - EVENING)*: {sampleStandup.stats.totalTasks} total,{' '}
                {sampleStandup.stats.completedTasks} completed, {sampleStandup.stats.overdueTasks} overdue.{' '}
                {sampleStandup.stats.activeBlockers} blockers reported.
              </p>
            ) : (
              <pre className="whitespace-pre-wrap">{sampleStandup.markdown}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
