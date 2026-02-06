import React, { useState } from 'react';
import { supabase } from './supabaseClient';

function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert("Login failed: " + error.message);
    } else {
      onLoginSuccess(data.user);
    }
    setLoading(false);
  };

  return (
    <div className="container vh-100 d-flex justify-content-center align-items-center">
      <div className="card shadow border-0" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="card-body p-5 text-center">
          <i className="bi bi-shield-lock text-success display-1 mb-4"></i>
          <h3 className="fw-bold mb-3">Admin Access</h3>
          <p className="text-muted mb-4">GoGreenSolar Inventory System</p>
          
          <form onSubmit={handleLogin}>
            <div className="form-floating mb-3 text-start">
              <input 
                type="email" 
                className="form-control" 
                id="floatingInput" 
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <label htmlFor="floatingInput">Email address</label>
            </div>
            <div className="form-floating mb-4 text-start">
              <input 
                type="password" 
                className="form-control" 
                id="floatingPassword" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <label htmlFor="floatingPassword">Password</label>
            </div>
            <button className="btn btn-success w-100 py-3 fw-bold" type="submit" disabled={loading}>
              {loading ? 'Authenticating...' : 'Login as Admin'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;