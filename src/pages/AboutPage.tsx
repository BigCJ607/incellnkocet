export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg)' }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {/* ── Large editorial hero ── */}
      <div
        style={{
          paddingTop: 'calc(var(--nav-h) + 6rem)',
          paddingBottom: '6rem',
          borderBottom: '1px solid var(--color-cream)',
          animation: 'fadeUp 0.6s ease both',
        }}
      >
        <div className="page-container">
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.22em',
            color: 'var(--color-slate-blue)', fontWeight: 600, margin: '0 0 24px', textTransform: 'uppercase',
          }}>
            About Ecell
          </p>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3.5rem, 9vw, 8rem)',
            color: 'var(--color-text-primary)',
            margin: '0 0 32px',
            lineHeight: 0.9,
            letterSpacing: '-0.03em',
            maxWidth: '14ch',
          }}>
            Where students build the future.
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 17, lineHeight: 1.8,
            color: 'var(--color-text-secondary)', maxWidth: '55ch', margin: 0,
          }}>
            Ecell is a student-run collective dedicated to building space for innovation and collaboration across campus.
            We run the hackathons, design sprints, and technical workshops that connect ideas to reality.
          </p>
        </div>
      </div>

      {/* ── Body sections ── */}
      <div className="page-container" style={{ paddingTop: 'var(--space-lg)', paddingBottom: 'var(--space-2xl)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 'var(--space-md)' }}>

          {/* Mission */}
          <div style={{
            padding: '40px 40px 48px',
            backgroundColor: 'var(--color-white)',
            border: '1px solid var(--color-cream)',
            animation: 'fadeUp 0.5s ease 0.1s both',
          }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-slate-blue)', fontWeight: 700, margin: '0 0 20px', textTransform: 'uppercase' }}>
              Mission
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.2rem, 2vw, 1.6rem)', color: 'var(--color-text-primary)', lineHeight: 1.45, margin: '0 0 20px', fontStyle: 'italic' }}>
              "Provide a space where students can challenge themselves, connect with mentors, and turn ideas into reality."
            </p>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.75, color: 'var(--color-text-secondary)', margin: 0 }}>
              Whether you're a first-year student curious about technology or a final-year developer with a side project in mind — our events are open, inclusive, and built around real outcomes.
            </p>
          </div>

          {/* What we do */}
          <div style={{
            padding: '40px 40px 48px',
            backgroundColor: 'var(--color-white)',
            border: '1px solid var(--color-cream)',
            animation: 'fadeUp 0.5s ease 0.2s both',
          }}>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-slate-blue)', fontWeight: 700, margin: '0 0 20px', textTransform: 'uppercase' }}>
              What We Do
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {[
                { label: 'Hackathons', desc: 'Multi-day building events with real problems, real judges, and real prizes.' },
                { label: 'Design Sprints', desc: 'Focused workshops that take you from problem to prototype in 48 hours.' },
                { label: 'Technical Talks', desc: 'Deep-dive sessions with industry engineers and researchers.' },
                { label: 'Open Projects', desc: 'Collaborative builds where teams take ownership of long-term ideas.' },
              ].map(({ label, desc }) => (
                <div key={label} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                  <div style={{ width: 3, height: '100%', minHeight: 36, backgroundColor: 'var(--color-sand)', flexShrink: 0, marginTop: 3 }} />
                  <div>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>{label}</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>



        {/* ── Join callout ── */}
        <div style={{
          marginTop: 'var(--space-md)',
          padding: '56px 48px',
          backgroundColor: 'var(--color-slate-blue)',
          animation: 'fadeUp 0.5s ease 0.4s both',
        }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.22em', color: 'rgba(245,241,232,0.6)', fontWeight: 600, margin: '0 0 16px', textTransform: 'uppercase' }}>
            Join the community
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: 'var(--color-ivory)', margin: '0 0 24px', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            Every event starts with someone who just showed up.
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'rgba(245,241,232,0.75)', margin: '0 0 32px', lineHeight: 1.7, maxWidth: '50ch' }}>
            Register for an upcoming event and see what you can build in 48 hours with the right people around you.
          </p>
          <a
            href="/events"
            style={{
              display: 'inline-block',
              padding: '16px 32px',
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              backgroundColor: 'var(--color-ivory)',
              color: 'var(--color-slate-blue)',
            }}
          >
            Browse Events →
          </a>
        </div>
      </div>
    </div>
  )
}
