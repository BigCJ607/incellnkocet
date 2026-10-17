import { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write the article body here...',
  minHeight = '320px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const [sourceCode, setSourceCode] = useState(value);

  // Sync incoming value to contentEditable when not focused
  useEffect(() => {
    if (editorRef.current && !editorRef.current.contains(document.activeElement)) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    setSourceCode(value || '');
  }, [value]);

  const emitChange = () => {
    if (editorRef.current) {
      const rawHtml = editorRef.current.innerHTML;
      const cleanHtml = DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: [
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'b', 'i', 'u', 'strong', 'em', 'strike',
          'ul', 'ol', 'li', 'blockquote', 'a', 'br', 'hr', 'code', 'pre', 'span'
        ],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'title'],
      });
      onChange(cleanHtml);
    }
  };

  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    if (isSourceMode) return;
    document.execCommand(command, false, arg);
    emitChange();
    editorRef.current?.focus();
  };

  const handleFormatBlock = (tag: string) => {
    if (isSourceMode) return;
    document.execCommand('formatBlock', false, `<${tag}>`);
    emitChange();
    editorRef.current?.focus();
  };

  const handleInsertLink = () => {
    if (isSourceMode) return;
    const url = window.prompt('Enter link URL (e.g. https://...):');
    if (url) {
      const validUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')
        ? url
        : `https://${url}`;
      executeCommand('createLink', validUrl);
    }
  };

  const toggleSourceMode = () => {
    if (isSourceMode) {
      // Switching back to WYSIWYG
      const sanitized = DOMPurify.sanitize(sourceCode);
      if (editorRef.current) {
        editorRef.current.innerHTML = sanitized;
      }
      onChange(sanitized);
      setIsSourceMode(false);
    } else {
      // Switching to Source view
      setSourceCode(editorRef.current?.innerHTML || value || '');
      setIsSourceMode(true);
    }
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSourceCode(e.target.value);
    onChange(DOMPurify.sanitize(e.target.value));
  };

  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-black/40 flex flex-col">
      {/* ── Editor Toolbar ── */}
      <div className="flex flex-wrap items-center gap-1.5 p-2 bg-slate-900/80 border-b border-white/10 select-none">
        {/* Headings */}
        <button
          type="button"
          onClick={() => handleFormatBlock('h2')}
          title="Heading 2"
          className="px-2.5 py-1 text-xs font-semibold rounded bg-white/5 hover:bg-white/15 text-slate-200 transition-colors"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => handleFormatBlock('h3')}
          title="Heading 3"
          className="px-2.5 py-1 text-xs font-semibold rounded bg-white/5 hover:bg-white/15 text-slate-200 transition-colors"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => handleFormatBlock('p')}
          title="Paragraph"
          className="px-2.5 py-1 text-xs font-semibold rounded bg-white/5 hover:bg-white/15 text-slate-200 transition-colors"
        >
          ¶ Text
        </button>

        <span className="w-px h-5 bg-white/10 mx-1" />

        {/* Inline styles */}
        <button
          type="button"
          onClick={() => executeCommand('bold')}
          title="Bold (Ctrl+B)"
          className="w-7 h-7 flex items-center justify-center rounded bg-white/5 hover:bg-white/15 text-slate-200 font-bold text-sm transition-colors"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => executeCommand('italic')}
          title="Italic (Ctrl+I)"
          className="w-7 h-7 flex items-center justify-center rounded bg-white/5 hover:bg-white/15 text-slate-200 italic font-serif text-sm transition-colors"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => executeCommand('underline')}
          title="Underline (Ctrl+U)"
          className="w-7 h-7 flex items-center justify-center rounded bg-white/5 hover:bg-white/15 text-slate-200 underline text-sm transition-colors"
        >
          U
        </button>

        <span className="w-px h-5 bg-white/10 mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => executeCommand('insertUnorderedList')}
          title="Bullet List"
          className="px-2.5 py-1 text-xs font-semibold rounded bg-white/5 hover:bg-white/15 text-slate-200 flex items-center gap-1 transition-colors"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => executeCommand('insertOrderedList')}
          title="Numbered List"
          className="px-2.5 py-1 text-xs font-semibold rounded bg-white/5 hover:bg-white/15 text-slate-200 flex items-center gap-1 transition-colors"
        >
          1. List
        </button>
        <button
          type="button"
          onClick={() => handleFormatBlock('blockquote')}
          title="Blockquote"
          className="px-2.5 py-1 text-xs font-semibold rounded bg-white/5 hover:bg-white/15 text-slate-200 transition-colors"
        >
          “ Quote
        </button>

        <span className="w-px h-5 bg-white/10 mx-1" />

        {/* Link */}
        <button
          type="button"
          onClick={handleInsertLink}
          title="Insert Link"
          className="px-2.5 py-1 text-xs font-semibold rounded bg-white/5 hover:bg-white/15 text-slate-200 flex items-center gap-1 transition-colors"
        >
          🔗 Link
        </button>

        {/* Clear formatting */}
        <button
          type="button"
          onClick={() => executeCommand('removeFormat')}
          title="Clear Formatting"
          className="px-2.5 py-1 text-xs rounded bg-white/5 hover:bg-white/15 text-slate-400 hover:text-slate-200 transition-colors"
        >
          ✕ Clear
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSourceMode}
            className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
              isSourceMode
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-white/5 hover:bg-white/15 text-slate-300'
            }`}
          >
            {isSourceMode ? '👁 Visual View' : '</> HTML Source'}
          </button>
        </div>
      </div>

      {/* ── Editor Canvas ── */}
      {isSourceMode ? (
        <textarea
          value={sourceCode}
          onChange={handleSourceChange}
          className="w-full p-4 font-mono text-xs text-amber-200/90 bg-black/60 focus:outline-none resize-y"
          style={{ minHeight }}
          placeholder="Type or paste HTML markup here..."
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={emitChange}
          onBlur={emitChange}
          className="p-5 font-body text-slate-200 text-sm focus:outline-none overflow-y-auto rich-text-canvas"
          style={{ minHeight }}
          data-placeholder={placeholder}
        />
      )}

      {/* Editor CSS styles for contentEditable area */}
      <style>{`
        .rich-text-canvas[contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: rgba(148, 163, 184, 0.4);
          pointer-events: none;
        }
        .rich-text-canvas h2 {
          font-family: var(--font-display, serif);
          font-size: 1.45rem;
          font-weight: 700;
          color: #ffffff;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .rich-text-canvas h3 {
          font-family: var(--font-display, serif);
          font-size: 1.2rem;
          font-weight: 600;
          color: #e2e8f0;
          margin-top: 1rem;
          margin-bottom: 0.4rem;
        }
        .rich-text-canvas p {
          margin-bottom: 0.75rem;
          line-height: 1.7;
          color: #cbd5e1;
        }
        .rich-text-canvas ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
          color: #cbd5e1;
        }
        .rich-text-canvas ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin-bottom: 0.75rem;
          color: #cbd5e1;
        }
        .rich-text-canvas li {
          margin-bottom: 0.25rem;
        }
        .rich-text-canvas blockquote {
          border-left: 3px solid #38bdf8;
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
          color: #94a3b8;
          background: rgba(56, 189, 248, 0.05);
          padding-top: 0.5rem;
          padding-bottom: 0.5rem;
        }
        .rich-text-canvas a {
          color: #38bdf8;
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
