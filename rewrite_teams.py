import re

with open(r'd:\tiredboss\src\pages\TeamsPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Replace specific background and border colors using precise string matches
code = code.replace("background: 'rgba(5,5,15,0.88)'", "backgroundColor: 'rgba(251,249,244,0.88)'")
code = code.replace("background: '#11111d'", "backgroundColor: 'var(--color-bg)'")
code = code.replace("border: '1px solid rgba(34,211,238,0.35)'", "border: '1px solid var(--color-sand)'")
code = code.replace("color: '#22d3ee'", "color: 'var(--color-slate-blue)'")
code = code.replace("color: '#fff'", "color: 'var(--color-text-primary)'")
code = code.replace("color: 'rgba(255,255,255,0.6)'", "color: 'var(--color-text-secondary)'")
code = code.replace("color: 'rgba(255,255,255,0.4)'", "color: 'var(--color-text-secondary)'")
code = code.replace("color: 'rgba(255,255,255,0.5)'", "color: 'var(--color-text-secondary)'")
code = code.replace("background: 'rgba(0,0,0,0.4)'", "backgroundColor: 'var(--color-white)'")
code = code.replace("background: 'rgba(255,255,255,0.03)'", "backgroundColor: 'var(--color-white)'")
code = code.replace("background: 'rgba(34,211,238,0.12)'", "backgroundColor: 'rgba(62,88,104,0.12)'")
code = code.replace("border: '1px solid rgba(255,255,255,0.12)'", "border: '1px solid var(--color-cream)'")
code = code.replace("border: '1px solid rgba(34,211,238,0.4)'", "border: '1px solid rgba(62,88,104,0.4)'")
code = code.replace("border: '1px solid rgba(255,255,255,0.08)'", "border: '1px solid var(--color-cream)'")
code = code.replace("color: '#475569'", "color: 'var(--color-text-secondary)'")
code = code.replace("background: 'rgba(34,211,238,0.08)'", "backgroundColor: 'rgba(62,88,104,0.08)'")
code = code.replace("border: '1px solid rgba(34,211,238,0.25)'", "border: '1px solid rgba(62,88,104,0.25)'")
code = code.replace("background: 'transparent'", "backgroundColor: 'transparent'")
code = code.replace("background: 'none'", "backgroundColor: 'transparent'")
code = code.replace("boxShadow: '0 25px 80px rgba(0,0,0,0.8)'", "boxShadow: '0 20px 40px rgba(0,0,0,0.1)'")
code = code.replace("background: 'rgba(245,158,11,0.04)'", "backgroundColor: 'var(--color-white)'")
code = code.replace("background: '#f59e0b'", "backgroundColor: 'var(--color-dusty-blue)'")
code = code.replace("color: '#fbbf24'", "color: 'var(--color-dusty-blue)'")
code = code.replace("color: '#f87171'", "color: 'var(--color-text-secondary)'")
code = code.replace("background: 'rgba(239,68,68,0.08)'", "backgroundColor: 'transparent'")
code = code.replace("border: '1px solid rgba(239,68,68,0.25)'", "border: '1px solid var(--color-sand)'")
code = code.replace("border: '1px solid rgba(239,68,68,0.3)'", "border: '1px solid var(--color-sand)'")
code = code.replace("var(--font-ui)", "var(--font-body)")

# TeamCard dynamic styles
code = re.sub(r"background: hovered \? \(isMine \? 'rgba\(34,211,238,0\.06\)' : 'rgba\(255,255,255,0\.04\)'\) : \(isMine \? 'rgba\(34,211,238,0\.03\)' : 'rgba\(255,255,255,0\.02\)'\)", r"backgroundColor: hovered ? 'var(--color-bg)' : 'var(--color-white)'", code)
code = re.sub(r"border: `1px solid \$\{hovered \? \(isMine \? 'rgba\(34,211,238,0\.5\)' : 'rgba\(255,255,255,0\.15\)'\) : \(isMine \? 'rgba\(34,211,238,0\.3\)' : 'rgba\(255,255,255,0\.07\)'\)\}`", r"border: '1px solid var(--color-sand)'", code)
code = re.sub(r"boxShadow: hovered \? \(isMine \? '0 12px 40px rgba\(34,211,238,0\.12\)' : '0 12px 32px rgba\(0,0,0,0\.3\)'\) : 'none'", r"boxShadow: hovered ? '0 12px 40px rgba(0,0,0,0.05)' : 'none'", code)

with open(r'd:\tiredboss\src\pages\TeamsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
