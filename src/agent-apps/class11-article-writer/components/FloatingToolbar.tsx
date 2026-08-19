import React, { useState } from 'react';

interface FloatingToolbarProps {
  selectionCoords: { top: number; left: number } | null;
  onFormat: (command: 'bold' | 'italic' | 'underline' | 'color' | 'link', value?: string) => void;
  onClose: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  selectionCoords,
  onFormat,
  onClose,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  if (!selectionCoords) return null;

  const colors = [
    { name: '預設', value: 'inherit', class: 'text-slate-800' },
    { name: '紅色', value: '#ef4444', class: 'text-red-500' },
    { name: '藍色', value: '#3b82f6', class: 'text-blue-500' },
    { name: '橘色', value: '#f97316', class: 'text-orange-500' },
    { name: '綠色', value: '#10b981', class: 'text-green-500' },
  ];

  const handleLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (linkUrl.trim()) {
      onFormat('link', linkUrl.trim());
      setLinkUrl('');
    }
    setShowLinkInput(false);
  };

  return (
    <div 
      className="absolute z-50 bg-slate-900 text-white rounded-lg shadow-xl px-2 py-1.5 flex items-center gap-1.5 border border-slate-800 text-xs animate-fade-in"
      style={{ 
        top: `${selectionCoords.top - 46}px`, 
        left: `${selectionCoords.left}px`,
        transform: 'translateX(-50%)'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {!showLinkInput ? (
        <>
          {/* Bold */}
          <button
            type="button"
            onClick={() => onFormat('bold')}
            className="hover:bg-slate-800 p-1 rounded transition-colors flex items-center justify-center"
            title="粗體"
          >
            <span className="material-symbols-outlined text-base">format_bold</span>
          </button>

          {/* Italic */}
          <button
            type="button"
            onClick={() => onFormat('italic')}
            className="hover:bg-slate-800 p-1 rounded transition-colors flex items-center justify-center"
            title="斜體"
          >
            <span className="material-symbols-outlined text-base">format_italic</span>
          </button>

          {/* Underline */}
          <button
            type="button"
            onClick={() => onFormat('underline')}
            className="hover:bg-slate-800 p-1 rounded transition-colors flex items-center justify-center"
            title="底線"
          >
            <span className="material-symbols-outlined text-base">format_underlined</span>
          </button>

          {/* Vertical divider */}
          <div className="w-[1px] h-4 bg-slate-800 self-center"></div>

          {/* Text Color */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowColorPicker(!showColorPicker);
                setShowLinkInput(false);
              }}
              className={`hover:bg-slate-800 p-1 rounded transition-colors flex items-center justify-center ${showColorPicker ? 'bg-slate-800' : ''}`}
              title="文字顏色"
            >
              <span className="material-symbols-outlined text-base">format_color_text</span>
            </button>

            {showColorPicker && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-800 rounded-lg p-1.5 shadow-2xl flex flex-col gap-1 w-24">
                {colors.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => {
                      onFormat('color', c.value);
                      setShowColorPicker(false);
                    }}
                    className="hover:bg-slate-800 px-2 py-1 text-left rounded text-[10px] flex items-center gap-1.5 transition-colors"
                  >
                    <span className={`inline-block w-2.5 h-2.5 rounded-full border border-white/20`} style={{ backgroundColor: c.value === 'inherit' ? 'white' : c.value }}></span>
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Link */}
          <button
            type="button"
            onClick={() => {
              setShowLinkInput(true);
              setShowColorPicker(false);
            }}
            className="hover:bg-slate-800 p-1 rounded transition-colors flex items-center justify-center"
            title="新增連結"
          >
            <span className="material-symbols-outlined text-base">link</span>
          </button>

          {/* Close */}
          <button
            type="button"
            onClick={onClose}
            className="hover:bg-slate-800 p-1 rounded transition-colors flex items-center justify-center text-slate-400 hover:text-white"
            title="關閉"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </>
      ) : (
        <form onSubmit={handleLinkSubmit} className="flex items-center gap-1.5 px-1 py-0.5">
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white w-32 focus:outline-none focus:border-blue-500"
            required
            autoFocus
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-0.5 rounded text-[10px] font-semibold"
          >
            確認
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="text-slate-400 hover:text-white p-0.5 rounded"
          >
            <span className="material-symbols-outlined text-xs">close</span>
          </button>
        </form>
      )}
    </div>
  );
};
