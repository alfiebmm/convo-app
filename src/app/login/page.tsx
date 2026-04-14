"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await signIn("nodemailer", { email, redirect: false });
      setEmailSent(true);
    } catch {
      setEmailSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@600;700&family=Outfit:wght@600;700;800&family=Inter:wght@400;500;600&display=swap');
        
        .login-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #09090B;
          padding: 24px;
          font-family: 'Inter', -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
        }
        
        .login-page::before {
          content: '';
          position: absolute;
          top: 30%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(255,107,44,0.06) 0%, transparent 65%);
          pointer-events: none;
        }
        
        .login-card {
          width: 100%;
          max-width: 400px;
          position: relative;
          z-index: 1;
        }
        
        .login-logo {
          text-align: center;
          margin-bottom: 8px;
        }
        
        .login-logo span {
          font-family: 'Fredoka', sans-serif;
          font-weight: 700;
          font-size: 40px;
          color: #FF6B2C;
          letter-spacing: -0.03em;
        }
        
        .login-tagline {
          text-align: center;
          font-size: 14px;
          color: #71717A;
          margin-bottom: 40px;
        }
        
        .login-box {
          background: #18181B;
          border: 1px solid #27272A;
          border-radius: 16px;
          padding: 32px;
        }
        
        .login-title {
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          font-size: 20px;
          color: #FAFAFA;
          text-align: center;
          margin-bottom: 24px;
        }
        
        .google-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 12px 20px;
          border-radius: 10px;
          border: 1px solid #3F3F46;
          background: #27272A;
          color: #FAFAFA;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'Inter', sans-serif;
        }
        
        .google-btn:hover {
          background: #3F3F46;
          border-color: #52525B;
        }
        
        .divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0;
        }
        
        .divider-line {
          flex: 1;
          height: 1px;
          background: #27272A;
        }
        
        .divider-text {
          font-size: 12px;
          color: #52525B;
          white-space: nowrap;
        }
        
        .email-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: #A1A1AA;
          margin-bottom: 6px;
        }
        
        .email-input {
          width: 100%;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid #3F3F46;
          background: #09090B;
          color: #FAFAFA;
          font-size: 14px;
          font-family: 'Inter', sans-serif;
          outline: none;
          transition: border-color 0.15s;
          box-sizing: border-box;
        }
        
        .email-input::placeholder {
          color: #52525B;
        }
        
        .email-input:focus {
          border-color: #FF6B2C;
        }
        
        .magic-btn {
          width: 100%;
          padding: 12px 20px;
          border-radius: 10px;
          border: none;
          background: #FF6B2C;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          margin-top: 16px;
          font-family: 'Inter', sans-serif;
        }
        
        .magic-btn:hover {
          background: #E85A1E;
        }
        
        .magic-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .login-footer {
          text-align: center;
          margin-top: 24px;
          font-size: 12px;
          color: #52525B;
        }
        
        .login-footer a {
          color: #71717A;
          text-decoration: underline;
        }
        
        .email-sent {
          text-align: center;
          padding: 16px 0;
        }
        
        .email-sent-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }
        
        .email-sent h2 {
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          font-size: 18px;
          color: #FAFAFA;
          margin-bottom: 8px;
        }
        
        .email-sent p {
          font-size: 14px;
          color: #71717A;
        }
        
        .email-sent p strong {
          color: #A1A1AA;
        }
        
        .retry-btn {
          background: none;
          border: none;
          color: #FF6B2C;
          font-size: 13px;
          cursor: pointer;
          margin-top: 16px;
          font-family: 'Inter', sans-serif;
        }
        
        .retry-btn:hover {
          text-decoration: underline;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #52525B;
          font-size: 13px;
          text-decoration: none;
          margin-bottom: 32px;
          transition: color 0.15s;
        }
        .back-link:hover { color: #A1A1AA; }
      `}</style>
      
      <div className="login-page">
        <div className="login-card">
          <a href="/" className="back-link">← Back to home</a>
          
          <div className="login-logo">
            <span>convo</span>
          </div>
          <div className="login-tagline">Conversations that convert</div>
          
          <div className="login-box">
            {emailSent ? (
              <div className="email-sent">
                <div className="email-sent-icon">📬</div>
                <h2>Check your email</h2>
                <p>
                  We sent a sign-in link to <strong>{email}</strong>
                </p>
                <button
                  onClick={() => setEmailSent(false)}
                  className="retry-btn"
                >
                  Use a different email
                </button>
              </div>
            ) : (
              <>
                <div className="login-title">Get started</div>
                
                <button
                  onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                  className="google-btn"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
                
                <div className="divider">
                  <div className="divider-line" />
                  <span className="divider-text">or continue with email</span>
                  <div className="divider-line" />
                </div>
                
                <form onSubmit={handleEmailSignIn}>
                  <label className="email-label">
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="email-input"
                  />
                  <button
                    type="submit"
                    disabled={loading || !email}
                    className="magic-btn"
                  >
                    {loading ? "Sending..." : "Send magic link →"}
                  </button>
                </form>
              </>
            )}
          </div>
          
          <div className="login-footer">
            By continuing, you agree to our <a href="/privacy">Privacy Policy</a> and <a href="/terms">Terms of Service</a>.
          </div>
        </div>
      </div>
    </>
  );
}
