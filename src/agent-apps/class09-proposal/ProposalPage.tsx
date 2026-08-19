import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAgent } from '../../agent/hooks/useAgent';
import type { ProposalDoc, ProposalBlock, ProposalSection, DocSummary, AppStatus, VersionSnapshot } from './types';
import { useProposalHistory } from './hooks/useHistory';
import {
  loadIndex,
  loadDoc,
  saveDoc,
  deleteDoc,
  saveVersionSnapshot,
  exportDocAsJson,
  getCurrentDocId,
  setCurrentDocId,
  incrementVersion,
} from './services/storageService';
import { DocumentCanvas } from './components/DocumentCanvas';
import { ProposalSidebar } from './components/ProposalSidebar';
import { VersionHistoryModal } from './components/VersionHistoryModal';
import { FileManagerView } from './components/FileManagerView';
import { CollapsibleSidebar, SidebarToggleButton, useCollapsibleSidebar } from '../../shared/components/CollapsibleSidebar';

type AppView = 'files' | 'editor';

const createEmptyDoc = (): ProposalDoc => {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: '未命名企劃書',
    metadata: { purpose: '', targetAudience: '', tone: '專業', pageCountEstimate: 5 },
    sections: [],
    publishedVersions: [],
    createdAt: now,
    updatedAt: now,
  };
};

export const ProposalPage: React.FC = () => {
  const { registerToolHandlers, setUiState, setRuntimeContext, sendMessageText } = useAgent();

  const [view, setView] = useState<AppView>(() =>
    getCurrentDocId() ? 'editor' : 'files'
  );
  const [docList, setDocList] = useState<DocSummary[]>(() => loadIndex());
  const [activeDocId, setActiveDocId] = useState<string | null>(() => getCurrentDocId());
  const [appStatus, setAppStatus] = useState<AppStatus>('idle');
  const [writingProgress, setWritingProgress] = useState('');
  const [zoom, setZoom] = useState(100);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const { doc, setDoc, loadDoc: loadDocIntoHistory, undo, redo, canUndo, canRedo } = useProposalHistory();
  const sidebar = useCollapsibleSidebar();

  // Stable refs so tool closures always see latest values without re-registering
  const docRef = useRef<ProposalDoc | null>(null);
  const setDocRef = useRef<(d: ProposalDoc) => void>(() => {});
  const setDocListRef = useRef<(l: DocSummary[]) => void>(() => {});
  const setActiveDocIdRef = useRef<(id: string | null) => void>(() => {});
  const setViewRef = useRef<(v: AppView) => void>(() => {});

  useEffect(() => { docRef.current = doc; }, [doc]);
  useEffect(() => { setDocRef.current = setDoc; }, [setDoc]);
  useEffect(() => { setDocListRef.current = setDocList; }, [setDocList]);
  useEffect(() => { setActiveDocIdRef.current = setActiveDocId; }, [setActiveDocId]);
  useEffect(() => { setViewRef.current = setView; }, [setView]);

  // Load doc when activeDocId changes
  useEffect(() => {
    if (activeDocId) {
      const loaded = loadDoc(activeDocId);
      loadDocIntoHistory(loaded);
      setCurrentDocId(activeDocId);
    } else {
      loadDocIntoHistory(null);
      setCurrentDocId(null);
    }
  }, [activeDocId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh doc list when doc changes
  useEffect(() => {
    setDocList(loadIndex());
  }, [doc]);

  // Sync runtime context for agent
  useEffect(() => {
    if (doc) {
      setRuntimeContext(
        `目前正在編輯企劃書：「${doc.title}」。` +
        `共 ${doc.sections.length} 個段落，` +
        `已完成 ${doc.sections.filter(s => s.isComplete).length} 個。` +
        (doc.sections.length > 0
          ? `\n段落清單：\n${doc.sections.map((s, i) => `  ${i + 1}. [id: ${s.id}] ${s.title} ${s.isComplete ? '(✓已完成)' : '(待撰寫)'}`).join('\n')}`
          : '')
      );
    } else {
      setRuntimeContext('目前在企劃書首頁，尚無開啟的文件。');
    }
  }, [doc, setRuntimeContext]);

  // Open chat on mount
  useEffect(() => {
    setUiState({ isOpened: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Doc management ──────────────────────────────────────────────────────

  const openDoc = useCallback((id: string) => {
    setActiveDocId(id);
    setView('editor');
  }, []);

  const handleCreateDoc = useCallback(() => {
    const newDoc = createEmptyDoc();
    saveDoc(newDoc);
    setDocList(loadIndex());
    setActiveDocId(newDoc.id);
    setView('editor');
  }, []);

  const handleDeleteDoc = useCallback((id: string) => {
    deleteDoc(id);
    const remaining = loadIndex();
    setDocList(remaining);
    if (activeDocId === id) {
      if (remaining.length > 0) {
        setActiveDocId(remaining[0].id);
      } else {
        setActiveDocId(null);
        setView('files');
      }
    }
  }, [activeDocId]);

  // ── Block mutations ──────────────────────────────────────────────────────

  const handleUpdateBlock = useCallback((sectionId: string, updated: ProposalBlock) => {
    if (!docRef.current) return;
    setDocRef.current({
      ...docRef.current,
      sections: docRef.current.sections.map(s =>
        s.id === sectionId
          ? { ...s, content: s.content.map(b => (b.id === updated.id ? updated : b)) }
          : s
      ),
    });
  }, []);

  const handleDeleteBlock = useCallback((sectionId: string, blockId: string) => {
    if (!docRef.current) return;
    setDocRef.current({
      ...docRef.current,
      sections: docRef.current.sections.map(s =>
        s.id === sectionId
          ? { ...s, content: s.content.filter(b => b.id !== blockId) }
          : s
      ),
    });
  }, []);

  // ── AI Rewrite ───────────────────────────────────────────────────────────

  const handleAiRewrite = useCallback((sectionId: string, block: ProposalBlock, userPrompt: string) => {
    const contentPreview =
      typeof block.content === 'string'
        ? block.content.slice(0, 200) + (block.content.length > 200 ? '…' : '')
        : '[表格內容]';

    const message =
      `請依照以下要求改寫指定區塊，完成後呼叫 update_block 工具套用修改。\n\n` +
      `所在段落 ID：${sectionId}\n` +
      `區塊 ID：${block.id}\n` +
      `區塊類型：${block.type}\n\n` +
      `原始內容：\n${contentPreview}\n\n` +
      `修改要求：${userPrompt}`;

    setUiState({ isOpened: true });
    sendMessageText(message);
  }, [setUiState, sendMessageText]);

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExport = () => {
    if (doc) exportDocAsJson(doc);
  };

  // ── Tool registration ────────────────────────────────────────────────────

  useEffect(() => {
    registerToolHandlers({

      get_document_state: () => {
        const current = docRef.current;
        if (!current) return { ok: false, error: '目前沒有開啟的文件，請先建立或選取企劃書。' };
        return { ok: true, data: current };
      },

      create_outline: (args) => {
        setAppStatus('planning');
        try {
          const {
            title = '未命名企劃書',
            purpose = '',
            targetAudience = '',
            tone = '專業',
            sections = [],
          } = args as {
            title?: string;
            purpose?: string;
            targetAudience?: string;
            tone?: string;
            sections?: Array<{ title: string; description?: string }>;
          };

          const now = Date.now();
          const base = docRef.current ?? { ...createEmptyDoc() };
          const newSections: ProposalSection[] = (
            sections as Array<{ title: string; description?: string }>
          ).map(s => ({
            id: crypto.randomUUID(),
            title: s.title,
            description: s.description ?? '',
            content: [],
            isComplete: false,
          }));

          const newDoc: ProposalDoc = {
            ...base,
            title: title as string,
            metadata: {
              purpose: purpose as string,
              targetAudience: targetAudience as string,
              tone: tone as string,
              pageCountEstimate: Math.max(newSections.length + 1, 3),
            },
            sections: newSections,
            updatedAt: now,
            createdAt: base.createdAt ?? now,
          };

          saveDoc(newDoc);
          setDocListRef.current(loadIndex());

          if (!docRef.current) {
            // No active doc — activate this new one
            setActiveDocIdRef.current(newDoc.id);
            setViewRef.current('editor');
          } else {
            setDocRef.current(newDoc);
          }

          setAppStatus('idle');
          return {
            ok: true,
            data: {
              docId: newDoc.id,
              title: newDoc.title,
              sectionCount: newSections.length,
              sections: newSections.map(s => ({ id: s.id, title: s.title })),
            },
          };
        } catch (err) {
          setAppStatus('idle');
          return { ok: false, error: `建立大綱失敗：${(err as Error).message}` };
        }
      },

      write_section: (args) => {
        setAppStatus('writing');
        try {
          const { sectionId, blocks = [] } = args as {
            sectionId: string;
            blocks: Array<{ type: string; content?: string; tableContent?: string[][] }>;
          };

          const current = docRef.current;
          if (!current) return { ok: false, error: '沒有開啟中的文件' };

          const section = current.sections.find(s => s.id === sectionId);
          if (!section) return { ok: false, error: `找不到段落 ID：${sectionId}` };

          setWritingProgress(`「${section.title}」`);

          const newBlocks: ProposalBlock[] = (
            blocks as Array<{ type: string; content?: string; tableContent?: string[][] }>
          ).map(b => ({
            id: crypto.randomUUID(),
            type: b.type as ProposalBlock['type'],
            content: b.type === 'table' ? (b.tableContent ?? []) : (b.content ?? ''),
          }));

          setDocRef.current({
            ...current,
            sections: current.sections.map(s =>
              s.id === sectionId ? { ...s, content: newBlocks, isComplete: true } : s
            ),
          });
          setAppStatus('idle');
          setWritingProgress('');
          return { ok: true, data: { sectionId, blockCount: newBlocks.length } };
        } catch (err) {
          setAppStatus('idle');
          setWritingProgress('');
          return { ok: false, error: `撰寫段落失敗：${(err as Error).message}` };
        }
      },

      refine_section: (args) => {
        setAppStatus('reviewing');
        try {
          const { sectionId, blocks = [] } = args as {
            sectionId: string;
            blocks: Array<{ type: string; content?: string; tableContent?: string[][] }>;
          };

          const current = docRef.current;
          if (!current) return { ok: false, error: '沒有開啟中的文件' };

          const newBlocks: ProposalBlock[] = (
            blocks as Array<{ type: string; content?: string; tableContent?: string[][] }>
          ).map(b => ({
            id: crypto.randomUUID(),
            type: b.type as ProposalBlock['type'],
            content: b.type === 'table' ? (b.tableContent ?? []) : (b.content ?? ''),
          }));

          setDocRef.current({
            ...current,
            sections: current.sections.map(s =>
              s.id === sectionId ? { ...s, content: newBlocks, isComplete: true } : s
            ),
          });
          setAppStatus('idle');
          return { ok: true, data: { sectionId, blockCount: newBlocks.length } };
        } catch (err) {
          setAppStatus('idle');
          return { ok: false, error: `修改段落失敗：${(err as Error).message}` };
        }
      },

      update_block: (args) => {
        try {
          const { sectionId, blockId, type, content } = args as {
            sectionId: string;
            blockId: string;
            type: string;
            content: string;
          };
          const current = docRef.current;
          if (!current) return { ok: false, error: '沒有開啟中的文件' };
          setDocRef.current({
            ...current,
            sections: current.sections.map(s =>
              s.id === sectionId
                ? {
                    ...s,
                    content: s.content.map(b =>
                      b.id === blockId ? { ...b, type: type as ProposalBlock['type'], content } : b
                    ),
                  }
                : s
            ),
          });
          return { ok: true, data: { blockId } };
        } catch (err) {
          return { ok: false, error: `更新區塊失敗：${(err as Error).message}` };
        }
      },

      publish_version: (args) => {
        try {
          const { versionType = 'patch', changeDescription = '版本更新' } = args as {
            versionType?: 'major' | 'minor' | 'patch';
            changeDescription?: string;
          };
          const current = docRef.current;
          if (!current) return { ok: false, error: '沒有開啟中的文件' };

          const lastVersion =
            current.publishedVersions[current.publishedVersions.length - 1]?.version ?? '0.0.0';
          const newVersion = incrementVersion(lastVersion, versionType as 'major' | 'minor' | 'patch');
          const now = Date.now();

          saveVersionSnapshot(current.id, {
            id: crypto.randomUUID(),
            timestamp: now,
            name: newVersion,
            doc: current,
          });

          setDocRef.current({
            ...current,
            publishedVersions: [
              ...current.publishedVersions,
              { version: newVersion, timestamp: now, changes: changeDescription as string },
            ],
          });
          return { ok: true, data: { version: newVersion } };
        } catch (err) {
          return { ok: false, error: `發布版本失敗：${(err as Error).message}` };
        }
      },
    });

    return () => registerToolHandlers({});
  }, [registerToolHandlers]);

  // ── Status label ─────────────────────────────────────────────────────────

  const statusLabel = () => {
    if (appStatus === 'planning') return '⏳ AI 規劃大綱中…';
    if (appStatus === 'writing')
      return `✏️ 撰寫段落${writingProgress ? ` ${writingProgress}` : ''}中…`;
    if (appStatus === 'reviewing') return '🔍 AI 修改段落中…';
    if (doc)
      return `就緒 — ${doc.sections.filter(s => s.isComplete).length}/${doc.sections.length} 節已完成`;
    return '就緒';
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (view === 'files') {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        <FileManagerView
          docList={docList}
          onOpenDoc={openDoc}
          onCreateDoc={handleCreateDoc}
          onDeleteDoc={handleDeleteDoc}
          onDocListChange={setDocList}
        />
        <div className="shrink-0 px-4 py-1.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-400 print:hidden">
          共 {docList.length} 份文件
        </div>
      </div>
    );
  }

  // Editor view
  return (
    <div className="flex flex-col h-full overflow-hidden print:block">
      {/* Editor header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white print:hidden">
        {doc && (
          <SidebarToggleButton
            collapsed={sidebar.toggleButtonState}
            onToggle={sidebar.toggle}
            className="mr-1"
          />
        )}
        <button
          onClick={() => setView('files')}
          className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 mr-1"
        >
          ← 返回
        </button>
        <span className="text-xs text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-700 truncate max-w-xs">
          {doc?.title ?? '…'}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Zoom */}
          <div className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded px-2 py-1">
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} className="hover:text-gray-800">−</button>
            <span className="w-10 text-center">{zoom}%</span>
            <button onClick={() => setZoom(z => Math.min(200, z + 10))} className="hover:text-gray-800">＋</button>
            <button onClick={() => setZoom(100)} className="text-gray-300 hover:text-gray-600 ml-1" title="重設">↺</button>
          </div>
          <button
            onClick={() => setShowVersionHistory(true)}
            disabled={!doc}
            className="text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 disabled:opacity-40"
          >
            版本紀錄
          </button>
          <button
            onClick={handleExport}
            disabled={!doc}
            className="text-xs text-gray-600 hover:text-gray-900 border border-gray-200 rounded px-2 py-1 disabled:opacity-40"
          >
            匯出 JSON
          </button>
          <button
            onClick={() => window.print()}
            disabled={!doc}
            className="text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded px-2 py-1 disabled:opacity-40"
          >
            列印
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden print:block">
        {/* Section nav sidebar */}
        {doc && (
          <CollapsibleSidebar
            label="章節"
            icon="list_alt"
            collapsed={sidebar.collapsed}
            mobileOpen={sidebar.mobileOpen}
            onMobileOpenChange={sidebar.setMobileOpen}
            className="border-r border-gray-200 bg-gray-50"
          >
            <ProposalSidebar
              doc={doc}
              canUndo={canUndo}
              canRedo={canRedo}
              onUndo={undo}
              onRedo={redo}
            />
          </CollapsibleSidebar>
        )}

        {/* Canvas area */}
        <div className="flex-1 overflow-auto bg-gray-100 py-6 px-4 print:bg-white print:p-0">
          {doc ? (
            <DocumentCanvas
              doc={doc}
              zoom={zoom}
              onUpdateBlock={handleUpdateBlock}
              onDeleteBlock={handleDeleteBlock}
              onAiRewrite={handleAiRewrite}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <span className="text-4xl">📋</span>
              <p className="text-gray-400 text-sm">文件載入中…</p>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="shrink-0 px-4 py-1.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center gap-2 print:hidden">
        {appStatus !== 'idle' && (
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        )}
        {statusLabel()}
      </div>

      {/* Version history modal */}
      {showVersionHistory && doc && (
        <VersionHistoryModal
          doc={doc}
          onClose={() => setShowVersionHistory(false)}
          onRestore={(snapshot: VersionSnapshot) => {
            setDoc(snapshot.doc);
            setShowVersionHistory(false);
          }}
        />
      )}
    </div>
  );
};
