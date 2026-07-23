import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import styles from './AuthPage.module.css';

export default function AuthPage() {
  const { login, signup, resetPassword } = useAuth();
  // 'login' | 'signup' | 'forgot'
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'forgot') {
      if (!form.email) {
        setError('Please enter your email address.');
        return;
      }
      setLoading(true);
      try {
        await resetPassword(form.email);
        setResetSent(true);
      } catch (err) {
        console.error('Reset password error code:', err.code, err.message);
        setError(firebaseErrorMessage(err.code));
      } finally {
        setLoading(false);
      }
      return;
    }

    if (mode === 'signup' && form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await signup(form.email, form.password);
      }
    } catch (err) {
      console.error('Auth error code:', err.code, err.message);
      const msg = firebaseErrorMessage(err.code);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setError('');
    setResetSent(false);
    setForm({ email: '', password: '', confirm: '' });
  };

  const goToForgot = () => {
    setMode('forgot');
    setError('');
    setResetSent(false);
    setForm((prev) => ({ ...prev, password: '', confirm: '' }));
  };

  const backToLogin = () => {
    setMode('login');
    setError('');
    setResetSent(false);
    setForm((prev) => ({ ...prev, password: '', confirm: '' }));
  };

  const titleText =
    mode === 'login' ? 'Sign in to continue'
    : mode === 'signup' ? 'Create your account'
    : 'Reset your password';

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>💳</span>
        </div>
        <h1 className={styles.title}>Credit Management</h1>
        <p className={styles.subtitle}>{titleText}</p>

        {error && (
          <div className={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        {mode === 'forgot' && resetSent ? (
          <>
            <div
              role="status"
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                color: '#16a34a',
                borderRadius: 8,
                padding: '12px 14px',
                fontSize: 14,
                lineHeight: 1.5,
                marginBottom: 16,
              }}
            >
              A password reset link has been sent to <strong>{form.email}</strong>.
              Check your inbox (and spam folder), click the link, and set a new
              password. You can then come back here and log in.
            </div>
            <button
              type="button"
              className={`btn btn-primary ${styles.submitBtn}`}
              onClick={backToLogin}
            >
              Back to Login
            </button>
          </>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="email">Email</label>
              <input
                className="input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>

            {mode !== 'forgot' && (
              <div className={styles.formGroup}>
                <label className="label" htmlFor="password">Password</label>
                <input
                  className="input"
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={handleChange}
                />
              </div>
            )}

            {mode === 'login' && (
              <p className={styles.toggle} style={{ marginTop: -8, textAlign: 'right' }}>
                <button
                  className={styles.toggleBtn}
                  onClick={goToForgot}
                  type="button"
                >
                  Forgot password?
                </button>
              </p>
            )}

            {mode === 'signup' && (
              <div className={styles.formGroup}>
                <label className="label" htmlFor="confirm">Confirm Password</label>
                <input
                  className="input"
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  placeholder="Re-enter password"
                  value={form.confirm}
                  onChange={handleChange}
                />
              </div>
            )}

            <button
              type="submit"
              className={`btn btn-primary ${styles.submitBtn}`}
              disabled={loading}
            >
              {loading
                ? 'Please wait…'
                : mode === 'login' ? 'Login'
                : mode === 'signup' ? 'Create Account'
                : 'Send Reset Link'}
            </button>
          </form>
        )}

        {!resetSent && (
          <p className={styles.toggle}>
            {mode === 'forgot' ? (
              <button className={styles.toggleBtn} onClick={backToLogin} type="button">
                Back to Login
              </button>
            ) : (
              <>
                {mode === 'login'
                  ? "Don't have an account? "
                  : 'Already have an account? '}
                <button className={styles.toggleBtn} onClick={toggleMode} type="button">
                  {mode === 'login' ? 'Sign Up' : 'Login'}
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function firebaseErrorMessage(code) {
  const map = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/operation-not-allowed':
      'Email/Password sign-in is not enabled. Please enable it in Firebase Console → Authentication → Sign-in method.',
    'auth/weak-password': 'Password is too weak. Use at least 6 characters.',
    'auth/missing-password': 'Please enter a password.',
    'auth/missing-email': 'Please enter an email address.',
    'auth/internal-error': 'An internal error occurred. Please try again.',
    'auth/unauthorized-continue-uri':
      'This domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.',
  };
  return map[code] || `Something went wrong (${code || 'unknown'}). Please try again.`;
}