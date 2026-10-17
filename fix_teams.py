import re

with open(r'd:\tiredboss\src\pages\TeamsPage.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

replacements = {
    r"color: 'rgba\(255,255,255,0\.25\)'": "color: 'var(--color-text-muted)'",
    r"color: 'rgba\(255,255,255,0\.35\)'": "color: 'var(--color-text-secondary)'",
    r"color: 'rgba\(255,255,255,0\.3\)'": "color: 'var(--color-text-secondary)'",
    r"color: 'rgba\(255,255,255,0\.2\)'": "color: 'var(--color-text-muted)'",
    r"color: 'rgba\(255,255,255,0\.12\)'": "color: 'var(--color-text-muted)'",
    r"color: 'rgba\(255,255,255,0\.7\)'": "color: 'var(--color-text-primary)'",
    r"border: '1px solid rgba\(255,255,255,0\.05\)'": "border: '1px solid var(--color-cream)'",
    r"border: '1px solid rgba\(255,255,255,0\.07\)'": "border: '1px solid var(--color-cream)'",
    r"border: '1px solid rgba\(255,255,255,0\.08\)'": "border: '1px solid var(--color-cream)'",
    r"border: '1px solid rgba\(255,255,255,0\.1\)'": "border: '1px solid var(--color-sand)'",
    r"border: '1px solid rgba\(255,255,255,0\.12\)'": "border: '1px solid var(--color-sand)'",
    r"borderBottom: '1px solid rgba\(255,255,255,0\.07\)'": "borderBottom: '1px solid var(--color-cream)'",
    r"border: '1px dashed rgba\(255,255,255,0\.07\)'": "border: '1px dashed var(--color-sand)'",
    r"background: 'rgba\(255,255,255,0\.02\)'": "background: 'var(--color-ivory)'",
    r"background: 'rgba\(255,255,255,0\.03\)'": "background: 'var(--color-ivory)'",
    r"background: 'rgba\(255,255,255,0\.05\)'": "background: 'var(--color-ivory)'",
    r"background: active \? 'rgba\(34,211,238,0\.07\)' : 'rgba\(255,255,255,0\.02\)'": "background: active ? 'rgba(34,211,238,0.07)' : 'var(--color-ivory)'",
    r"background: enrolled \? 'rgba\(34,211,238,0\.12\)' : 'rgba\(255,255,255,0\.05\)'": "background: enrolled ? 'rgba(34,211,238,0.12)' : 'var(--color-ivory)'",
    r"background: showCreate \? 'rgba\(255,255,255,0\.05\)' : 'rgba\(34,211,238,0\.12\)'": "background: showCreate ? 'var(--color-ivory)' : 'rgba(34,211,238,0.12)'",
    r"border: `1px solid \$\{showCreate \? 'rgba\(255,255,255,0\.12\)' : 'rgba\(34,211,238,0\.4\)'\}`": "border: `1px solid ${showCreate ? 'var(--color-cream)' : 'rgba(34,211,238,0.4)'}`",
    r"stroke=\"rgba\(255,255,255,0\.25\)\"": "stroke=\"var(--color-slate-blue)\"",
    r"stroke=\"rgba\(255,255,255,0\.12\)\"": "stroke=\"var(--color-slate-blue)\"",
    r"border: `1px solid \$\{selectedId === m\.userId \? 'rgba\(34,211,238,0\.4\)' : 'rgba\(255,255,255,0\.08\)'\}`": "border: `1px solid ${selectedId === m.userId ? 'rgba(34,211,238,0.4)' : 'var(--color-cream)'}`",
    r"color: showCreate \? 'rgba\(255,255,255,0\.5\)' : '#22d3ee'": "color: showCreate ? 'var(--color-text-secondary)' : '#22d3ee'"
}

for pattern, repl in replacements.items():
    text = re.sub(pattern, repl, text)

with open(r'd:\tiredboss\src\pages\TeamsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("Done replacing colors.")
