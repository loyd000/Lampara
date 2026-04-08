import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';
import { useNavigate } from 'react-router-dom';
import './Admin.css'; // Re-use admin styling

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    // Verify if we actually have a session to update
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
                setError('No valid session found. Please request a new password reset link.');
            }
        });
    }, []);

    const handleUpdate = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            setError(error.message);
        } else {
            setSuccess(true);
            setTimeout(() => navigate('/admin'), 2000);
        }
        setLoading(false);
    };

    return (
        <div className="admin-login">
            <div className="admin-login__card">
                <div className="admin-login__header">
                    <img src="/assets/logo.png" alt="Lampara" className="admin-login__logo" />
                    <h1>Reset Password</h1>
                    <p>Enter your new admin password</p>
                </div>

                {success ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--navy)' }}>
                        <p style={{ fontWeight: 500 }}>✅ Password successfully updated!</p>
                        <p style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>Redirecting to login...</p>
                    </div>
                ) : (
                    <form onSubmit={handleUpdate} className="admin-login__form">
                        <div className="admin-field">
                            <label htmlFor="new-password">New Password</label>
                            <input
                                type="password"
                                id="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={10}
                                placeholder="Min. 10 characters"
                            />
                        </div>

                        {error && <p className="admin-error">{error}</p>}

                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            style={{ width: '100%' }} 
                            disabled={loading || !password}
                        >
                            {loading ? 'Updating...' : 'Update Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
