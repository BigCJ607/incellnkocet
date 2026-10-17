import React, { useState } from 'react';

interface ShareButtonsProps {
  title: string;
  url?: string;
  compact?: boolean;
}

export default function ShareButtons({ title, url, compact = true }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareX = () => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(`${title} via @ecell_nkocet`);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareLinkedIn = () => {
    const encodedUrl = encodeURIComponent(shareUrl);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`*${title}*\n${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        position: 'relative',
      }}
    >
      {/* Copy Link Button with 2-second "Copied!" tooltip/feedback */}
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={handleCopyLink}
          title="Copy link"
          aria-label="Copy link"
          className="news-share-btn"
          style={{
            borderColor: copied ? 'var(--color-slate-blue)' : undefined,
            backgroundColor: copied ? 'var(--color-slate-blue)' : undefined,
            color: copied ? '#FFFFFF' : undefined,
          }}
        >
          {copied ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          )}
        </button>

        {copied && (
          <div
            style={{
              position: 'absolute',
              bottom: 'calc(100% + 6px)',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--color-slate-blue, #3E5868)',
              color: '#FFFFFF',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '4px',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 30,
              fontFamily: 'var(--font-body)',
              animation: 'newsFadeIn 150ms ease both',
            }}
          >
            Copied!
          </div>
        )}
      </div>

      {/* X (formerly Twitter) */}
      <button
        type="button"
        onClick={handleShareX}
        title="Share on X"
        aria-label="Share on X"
        className="news-share-btn"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </button>

      {/* LinkedIn */}
      <button
        type="button"
        onClick={handleShareLinkedIn}
        title="Share on LinkedIn"
        aria-label="Share on LinkedIn"
        className="news-share-btn"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
        </svg>
      </button>

      {/* WhatsApp */}
      <button
        type="button"
        onClick={handleShareWhatsApp}
        title="Share on WhatsApp"
        aria-label="Share on WhatsApp"
        className="news-share-btn"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.031 2c-5.508 0-9.985 4.477-9.985 9.985 0 1.762.46 3.483 1.332 5.001l-1.416 5.174 5.297-1.39c1.467.8 3.125 1.222 4.772 1.222 5.508 0 9.985-4.477 9.985-9.985s-4.477-9.985-9.985-9.985zm5.82 14.288c-.244.686-1.42 1.294-1.956 1.378-.518.081-1.18.114-3.805-.964-3.355-1.378-5.503-4.805-5.669-5.029-.167-.224-1.365-1.815-1.365-3.463 0-1.648.864-2.459 1.171-2.793.308-.334.673-.418.898-.418.224 0 .449.002.645.012.208.01.486-.079.76.579.284.684.969 2.365 1.054 2.538.085.173.142.375.028.6-.114.225-.172.365-.341.564-.17.199-.356.444-.509.596-.17.169-.348.353-.15.694.198.341.88 1.454 1.888 2.353 1.298 1.157 2.392 1.516 2.733 1.685.341.17.542.142.742-.089.2-.231.855-.996 1.084-1.337.228-.341.456-.284.767-.17.311.114 1.97 1.054 2.308 1.228.338.174.563.261.645.405.083.143.083.829-.161 1.515z" />
        </svg>
      </button>
    </div>
  );
}
