import React, { useEffect, useState } from 'react';
import { useAgentSettings } from '../hooks/useAgentSettings';
import { fetchGeminiModels, LIVE_MODELS, OFFLINE_MODELS, MULTIMEDIA_GEN_MODELS } from '../services/geminiService';
import { LIVE_VOICES } from '../services/liveInteractionService';
import { Button } from '../../shared/components/Button';
import { useAgent } from '../hooks/useAgent';

export const AgentSettingsPanel: React.FC = () => {
  const {
    apiKey,
    model,
    liveApiKey,
    liveModel,
    liveVoice,
    imageModel,
    systemPrompt,
    updateSettings,
    resetAllSettings
  } = useAgentSettings();
  const { activeAppManifest } = useAgent();

  const [keyInput, setKeyInput] = useState(apiKey);
  const [liveKeyInput, setLiveKeyInput] = useState(liveApiKey);
  const [liveKeyError, setLiveKeyError] = useState<string | null>(null);
  const [promptInput, setPromptInput] = useState(systemPrompt);
  const [models, setModels] = useState<string[]>(OFFLINE_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setKeyInput(apiKey);
  }, [apiKey]);

  useEffect(() => {
    setLiveKeyInput(liveApiKey);
  }, [liveApiKey]);

  useEffect(() => {
    setPromptInput(systemPrompt);
  }, [systemPrompt]);

  useEffect(() => {
    if (!apiKey) {
      setModels(OFFLINE_MODELS);
      setFetchError(false);
      return;
    }

    const loadModels = async () => {
      setIsLoadingModels(true);
      setFetchError(false);
      try {
        const list = await fetchGeminiModels(apiKey);
        if (list.length > 0) {
          setModels(list);
          if (!list.includes(model)) {
            updateSettings({ model: list[0] });
          }
        } else {
          setModels(OFFLINE_MODELS);
        }
      } catch (error) {
        console.warn('Failed to load models dynamically, falling back to offline list', error);
        setModels(OFFLINE_MODELS);
        setFetchError(true);
      } finally {
        setIsLoadingModels(false);
      }
    };

    void loadModels();
  }, [apiKey, model, refreshTrigger]);

  const handleSave = () => {
    const trimmedLiveKey = liveKeyInput.trim();
    if (trimmedLiveKey.startsWith('sk-')) {
      setLiveKeyError('This is the platform\'s virtual key — it cannot reach the Live API. Paste a real Gemini API key or a Live ephemeral token instead.');
      return;
    }
    setLiveKeyError(null);
    updateSettings({
      apiKey: keyInput.trim(),
      liveApiKey: trimmedLiveKey,
      systemPrompt: promptInput
    });
  };

  const handleClearAllSettings = () => {
    if (window.confirm('Clear all local agent settings?')) {
      resetAllSettings();
      setKeyInput('');
      setLiveKeyInput('');
      setLiveKeyError(null);
      setPromptInput('You are a helpful assistant. Provide detailed and accurate responses.');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto border-l border-slate-200 bg-slate-50 p-4 text-xs text-gray-700">
      <h3 className="mb-4 flex items-center gap-1 text-sm font-semibold text-gray-900">
        <span className="material-symbols-outlined text-base">settings</span>
        AI assistant settings
      </h3>

      <div className="mb-4">
        <label className="mb-1.5 block font-semibold text-gray-800">
          Gemini API Key
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="AI Studio API Key"
            className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button
            size="sm"
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
          >
            Save
          </Button>
        </div>
        <p className="mt-1 text-[10px] text-gray-400">
          The key is stored in this browser localStorage for the classroom demo.
        </p>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block font-semibold text-gray-800">
          Chat model
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <select
              value={model}
              onChange={(e) => updateSettings({ model: e.target.value })}
              disabled={isLoadingModels}
              className="w-full cursor-pointer rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              {models.map((item) => (
                <option key={item} value={item}>
                  {item} {fetchError ? '(offline)' : ''}
                </option>
              ))}
            </select>
            {isLoadingModels && (
              <div className="absolute right-8 top-2 flex items-center">
                <span className="material-symbols-outlined text-xs text-slate-400 animate-spin">sync</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            disabled={isLoadingModels || !apiKey}
            className="rounded border border-slate-300 bg-white px-2.5 hover:bg-slate-50 disabled:opacity-50 flex items-center justify-center transition"
            title="Refresh model list"
          >
            <span className="material-symbols-outlined text-sm font-semibold">refresh</span>
          </button>
        </div>
        {fetchError && (
          <p className="mt-1 text-[10px] text-orange-500">
            Unable to load model list from API. Using the offline fallback list.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block font-semibold text-gray-800">
          Live chat API Key
        </label>
        <div className="flex gap-2">
          <input
            type="password"
            value={liveKeyInput}
            onChange={(e) => {
              setLiveKeyInput(e.target.value);
              setLiveKeyError(null);
            }}
            placeholder="Gemini API Key or Live ephemeral token"
            className="flex-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button
            size="sm"
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
          >
            Save
          </Button>
        </div>
        {liveKeyError ? (
          <p className="mt-1 text-[10px] text-red-500">{liveKeyError}</p>
        ) : (
          <p className="mt-1 text-[10px] text-gray-400">
            A real Gemini API key or a Live ephemeral token generated on the API Key Manager page.
            The platform's virtual key does not work here.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block font-semibold text-gray-800">
          Realtime voice model
        </label>
        <select
          value={liveModel}
          onChange={(e) => updateSettings({ liveModel: e.target.value })}
          className="w-full cursor-pointer rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {LIVE_MODELS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block font-semibold text-gray-800">
          Image/Video generation model
        </label>
        <select
          value={imageModel}
          onChange={(e) => updateSettings({ imageModel: e.target.value })}
          className="w-full cursor-pointer rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {MULTIMEDIA_GEN_MODELS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="mb-1.5 block font-semibold text-gray-800">
          Realtime voice
        </label>
        <select
          value={liveVoice}
          onChange={(e) => updateSettings({ liveVoice: e.target.value })}
          className="w-full cursor-pointer rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {LIVE_VOICES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-gray-400">
          Takes effect the next time realtime voice is started.
        </p>
      </div>

      <div className="mb-4 rounded border border-emerald-200 bg-white p-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-gray-800">Google Search grounding</div>
            <div className="text-[10px] text-gray-400">
              Always enabled. The app does not expose this as a user switch.
            </div>
          </div>
          <span className="rounded bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
            Always on
          </span>
        </div>
      </div>

      <div className="mb-4 rounded border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="font-semibold text-gray-800">Current AgentApp capabilities</div>
        <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-gray-500">
          <span>Files: {activeAppManifest?.supportedUploads?.files ? 'yes' : 'no'}</span>
          <span>Photos: {activeAppManifest?.supportedUploads?.images ? 'yes' : 'no'}</span>
          <span>Voice: {activeAppManifest?.supportsRealtimeVoice ? 'yes' : 'no'}</span>
          <span>Vision stream: {activeAppManifest?.supportsVisionStream ? 'yes' : 'no'}</span>
          <span>Screen stream: {activeAppManifest?.supportsScreenStream ? 'yes' : 'no'}</span>
        </div>
      </div>

      <div className="mb-5 flex flex-col">
        <label className="mb-1.5 block font-semibold text-gray-800">
          Global system prompt
        </label>
        <textarea
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          className="h-24 w-full resize-none rounded border border-slate-300 bg-white p-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            onClick={handleSave}
            className="rounded bg-blue-600 px-3 text-xs text-white hover:bg-blue-700"
          >
            Save prompt
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-slate-200 pt-4">
        <button
          onClick={handleClearAllSettings}
          className="w-full rounded border border-red-200 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          Clear all local settings
        </button>
      </div>
    </div>
  );
};
