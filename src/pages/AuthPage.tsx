import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authService } from '../services/authService'
import { useApp } from '../context/AppContext'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [hoveredButton, setHoveredButton] = useState(false)
  const { login } = useApp()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
      let user;
      if (isLogin) {
        user = await authService.login(email, password)
      } else {
        user = await authService.register(name, email, password)
      }
      login(user)
      navigate('/') // Redirect to events catalog after login
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'var(--color-white)',
    border: '1px solid rgba(62, 88, 104, 0.2)', // subtle navy border
    borderRadius: '16px', // slightly softer corners
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    padding: '1.2rem', // increased padding on all sides
    textAlign: 'center', // center the text box
    outline: 'none',
    transition: 'all 0.2s ease',
  }
  const inputFocusStyle = { borderColor: 'var(--color-slate-blue)', background: 'var(--color-white)', boxShadow: '0 0 0 4px rgba(62, 88, 104, 0.1)' }

  return (
    <div className="w-full min-h-screen flex items-center justify-center p-4 sm:p-8 pt-20 sm:pt-16 relative overflow-hidden bg-[var(--color-bg)]">
      {/* Background with the poster image, heavily blurred */}
      <div 
        className="absolute inset-0 z-0" 
        style={{ 
          backgroundImage: 'url(/eureka-poster-dark.jpg)', 
          backgroundSize: 'cover', 
          backgroundPosition: 'center', 
          filter: 'blur(40px) brightness(1.1)', // bright and colorful
          transform: 'scale(1.1)', // To prevent blur edges from showing
          opacity: 0.6
        }} 
      />
      
      {/* Cream overlay to soften the background */}
      <div className="absolute inset-0 z-0 pointer-events-none mix-blend-overlay" style={{ background: 'var(--color-cream)', opacity: 0.8 }} />
      <div className="absolute inset-0 z-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, rgba(245, 241, 232, 0.4), rgba(229, 227, 217, 0.8))' }} />

      {/* Override browser autofill styling */}
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 1000px var(--color-white) inset !important;
          -webkit-text-fill-color: var(--color-text-primary) !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
      
      {/* The Main Split Card */}
      <div 
        className="w-full max-w-[1100px] min-h-[580px] relative z-10 flex flex-col md:flex-row rounded-[2rem] overflow-hidden bg-white my-auto"
        style={{
          boxShadow: '0 40px 80px -20px rgba(0, 0, 0, 0.25), 0 15px 35px rgba(0, 0, 0, 0.1)'
        }}
      >
        {/* Left Panel: The Eureka Poster */}
        <div 
          className="hidden md:flex md:w-1/2 relative bg-contain bg-no-repeat bg-center"
          style={{ backgroundImage: 'url(/eureka-poster-dark.jpg)', backgroundColor: '#092147' }}
        >
          {/* Subtle overlay just to make the back button readable */}
          <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-black/40 to-transparent" />
          
          <div className="relative z-10 p-8">
            <Link to="/" className="font-ui font-bold text-[10px] tracking-widest text-white inline-flex items-center gap-2 hover:opacity-70 transition-opacity uppercase bg-black/30 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/20">
              <span style={{ fontSize: '14px' }}>←</span> BACK TO HOME
            </Link>
          </div>
          {/* No extra text overlay since the poster has its own text */}
        </div>

        {/* Right Panel: The Form */}
        <div className="w-full md:w-1/2 px-6 py-10 sm:px-16 sm:py-16 flex flex-col justify-center items-center relative">
          
          {/* Mobile Back Button */}
          <Link to="/" className="md:hidden font-ui font-bold text-xs tracking-widest text-[var(--color-slate-blue)] mb-6 inline-flex items-center gap-2 hover:opacity-70 transition-opacity w-full max-w-sm">
            <span style={{ fontSize: '16px' }}>←</span> BACK TO HOME
          </Link>

          <div className="mb-8 text-center w-full max-w-sm">
            {/* Switched to a sans-serif / body font and centered perfectly with the form */}
            <h1 className="font-body text-3xl sm:text-4xl mb-2 sm:mb-3 font-extrabold tracking-tight leading-tight" style={{ color: 'var(--color-slate-blue)' }}>
              {isLogin ? 'Welcome Back' : 'Join the Network'}
            </h1>
            <p className="text-xs sm:text-sm font-body leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              {isLogin ? 'Enter your account credentials to access your tickets.' : 'Create your student account to register for events.'}
            </p>
          </div>

          {error && <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-50 text-red-600 text-sm font-ui text-center w-full max-w-sm">{error}</div>}

          <form className="space-y-5 max-w-sm w-full" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="text-center">
                <label className="font-ui font-bold text-[10px] tracking-widest block mb-2 uppercase" style={{ color: 'var(--color-text-secondary)' }}>Full Name</label>
                <input 
                  type="text" 
                  style={inputStyle} 
                  onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)} 
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(62, 88, 104, 0.2)';
                    e.target.style.background = 'var(--color-white)';
                    e.target.style.boxShadow = 'none';
                  }} 
                  placeholder="Enter your full name" 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            <div className="text-center">
              <label className="font-ui font-bold text-[10px] tracking-widest block mb-2 uppercase" style={{ color: 'var(--color-text-secondary)' }}>Email Address</label>
              <input 
                type="email" 
                style={inputStyle} 
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)} 
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(62, 88, 104, 0.2)';
                  e.target.style.background = 'var(--color-white)';
                  e.target.style.boxShadow = 'none';
                }} 
                placeholder="Enter your email" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="text-center relative">
              <div className="flex justify-center items-center mb-2 relative">
                <label className="font-ui font-bold text-[10px] tracking-widest uppercase m-0" style={{ color: 'var(--color-text-secondary)' }}>Password</label>
              </div>
              <input 
                type="password" 
                style={inputStyle} 
                onFocus={(e) => Object.assign(e.target.style, inputFocusStyle)} 
                onBlur={(e) => {
                  e.target.style.borderColor = 'rgba(62, 88, 104, 0.2)';
                  e.target.style.background = 'var(--color-white)';
                  e.target.style.boxShadow = 'none';
                }} 
                placeholder="••••••••" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
              {isLogin && (
                <div className="mt-3 text-center">
                  <a href="#" className="font-ui text-[10px] tracking-wide text-gray-400 hover:text-[var(--color-slate-blue)] transition-colors">Forgot password?</a>
                </div>
              )}
            </div>

            <div className="flex justify-center w-full mt-8">
              <button 
                type="submit" 
                disabled={loading} 
                onMouseEnter={() => setHoveredButton(true)}
                onMouseLeave={() => setHoveredButton(false)}
                className="w-full max-w-[240px] py-4 text-sm font-bold tracking-widest uppercase rounded-full transition-all duration-300" 
                style={{ 
                  background: hoveredButton ? '#2a363b' : 'var(--color-slate-blue)',
                  color: '#ffffff',
                  boxShadow: hoveredButton ? '0 10px 20px -5px rgba(62, 88, 104, 0.4)' : '0 4px 6px -1px rgba(62, 88, 104, 0.1)',
                  opacity: loading ? 0.7 : 1,
                  transform: loading ? 'scale(0.98)' : (hoveredButton ? 'translateY(-1px)' : 'translateY(0)'),
                }}
              >
                {loading ? 'PROCESSING...' : (isLogin ? 'SIGN IN' : 'CREATE ACCOUNT')}
              </button>
            </div>
          </form>

          {/* Secondary Action Link at the bottom */}
          <div className="mt-12 text-center w-full max-w-sm">
            <button 
              type="button"
              onClick={() => { setIsLogin(!isLogin); setError(''); }}
              className="font-ui font-medium text-xs tracking-wide cursor-pointer transition-colors"
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', textDecoration: 'underline', textUnderlineOffset: '4px' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-slate-blue)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--color-text-secondary)')}
            >
              {isLogin ? "Don't have an account? Register" : "Already have an account? Sign In"}
            </button>
          </div>
          
        </div>
      </div>
    </div>
  )
}
