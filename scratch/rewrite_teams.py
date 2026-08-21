import re

with open(r'd:\tiredboss\src\pages\TeamsPage.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Map colors to light theme variables
code = code.replace("'#11111d'", "'var(--color-bg)'")
code = code.replace("rgba(5,5,15,0.88)", "rgba(251,249,244,0.88)") # bg-overlay
code = code.replace("'#22d3ee'", "'var(--color-slate-blue)'")
code = code.replace("rgba(34,211,238,", "rgba(62,88,104,") # slate blue rgb
code = code.replace("'#fff'", "'var(--color-text-primary)'")
code = code.replace("rgba(255,255,255,0.06)", "'var(--color-cream)'")
code = code.replace("rgba(255,255,255,", "rgba(32,40,43,") # dark text alpha
code = code.replace("rgba(0,0,0,0.4)", "'var(--color-white)'")
code = code.replace("'#a5b4fc'", "'var(--color-slate-blue)'")
code = code.replace("'#818cf8'", "'var(--color-slate-blue)'")
code = code.replace("rgba(129,140,248,", "rgba(62,88,104,")
code = code.replace("rgba(99,102,241,", "rgba(62,88,104,")
code = code.replace("'#34d399'", "'var(--color-dusty-blue)'")
code = code.replace("rgba(52,211,153,", "rgba(118,137,151,") # dusty blue rgb
code = code.replace("var(--font-ui)", "var(--font-body)")

# TeamCard style tweaks
code = re.sub(
    r"background: hovered \? .*?,", 
    r"backgroundColor: hovered ? 'var(--color-bg)' : 'var(--color-white)',",
    code
)

code = re.sub(
    r"border: `1px solid \$\{hovered \? .*?\}`,", 
    r"border: '1px solid var(--color-sand)',",
    code
)

code = re.sub(
    r"boxShadow: hovered \? .*?,", 
    r"boxShadow: hovered ? '0 12px 40px rgba(0,0,0,0.05)' : 'none',",
    code
)

# Text accent logic in TeamCard
code = code.replace("color: hovered ? accent : 'var(--color-text-primary)'", "color: 'var(--color-text-primary)'")

# Create team / layout backgrounds
code = code.replace("background: 'var(--color-bg)'", "backgroundColor: 'var(--color-white)'")
code = code.replace("background: '#0a0a0f'", "backgroundColor: 'var(--color-bg)'")
code = code.replace("background: 'transparent'", "backgroundColor: 'transparent'")
code = code.replace("background: 'none'", "backgroundColor: 'transparent'")
code = code.replace("boxShadow: '0 0 6px var(--color-dusty-blue)'", "boxShadow: 'none'")
code = code.replace("boxShadow: '0 25px 80px rgba(0,0,0,0.8)'", "boxShadow: '0 20px 40px rgba(0,0,0,0.1)'")

with open(r'd:\tiredboss\src\pages\TeamsPage.tsx', 'w', encoding='utf-8') as f:
    f.write(code)
