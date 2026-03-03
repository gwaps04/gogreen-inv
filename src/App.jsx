import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Suppliers from './Suppliers';
import Outbound from './Outbound';
import InventoryList from './InventoryList';
import Login from './Login';
import JobOrders from './JobOrders';
import MaterialMaster from './MaterialMaster';
import StockOrders from './StockOrders';
import Inbound from './Inbound'; // New component imported correctly

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  if (!session) return <Login onLoginSuccess={(user) => setSession(user)} />;

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-expand-lg navbar-dark bg-success shadow sticky-top">
        <div className="container">
          <span className="navbar-brand fw-bold"><i className="bi bi-sun-fill me-2"></i>Go Green Solar</span>
          <button className="navbar-toggler border-0" type="button" data-bs-toggle="collapse" data-bs-target="#goGreenNavbar"><span className="navbar-toggler-icon"></span></button>
          <div className="collapse navbar-collapse" id="goGreenNavbar">
            <div className="navbar-nav ms-auto py-3 py-lg-0">
              <button className={`nav-link border-0 bg-transparent text-start ${activeTab === 'dashboard' ? 'active fw-bold border-bottom' : ''}`} onClick={() => setActiveTab('dashboard')}>Inventory</button>
              <button className={`nav-link border-0 bg-transparent text-start ${activeTab === 'materials' ? 'active fw-bold border-bottom' : ''}`} onClick={() => setActiveTab('materials')}>Material Master</button>
              <button className={`nav-link border-0 bg-transparent text-start ${activeTab === 'stockorders' ? 'active fw-bold border-bottom' : ''}`} onClick={() => setActiveTab('stockorders')}>Stock Orders</button>
              <button className={`nav-link border-0 bg-transparent text-start ${activeTab === 'joborders' ? 'active fw-bold border-bottom' : ''}`} onClick={() => setActiveTab('joborders')}>Job Orders</button>
              <button className={`nav-link border-0 bg-transparent text-start ${activeTab === 'inbound' ? 'active fw-bold border-bottom' : ''}`} onClick={() => setActiveTab('inbound')}>Inbound</button>
              <button className={`nav-link border-0 bg-transparent text-start ${activeTab === 'outbound' ? 'active fw-bold border-bottom' : ''}`} onClick={() => setActiveTab('outbound')}>Outbound</button>
              <button className={`nav-link border-0 bg-transparent text-start ${activeTab === 'suppliers' ? 'active fw-bold border-bottom' : ''}`} onClick={() => setActiveTab('suppliers')}>Suppliers</button>
              <button className="btn btn-sm btn-outline-light mt-3 mt-lg-0 ms-lg-3 px-3" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container py-4 py-md-5">
        {activeTab === 'dashboard' && <InventoryList />}
        {activeTab === 'materials' && <MaterialMaster />}
        {activeTab === 'stockorders' && <StockOrders />}
        {activeTab === 'joborders' && <JobOrders />}
        {activeTab === 'suppliers' && <Suppliers />}
        
        {/* FIXED: Now correctly rendering the Inbound component */}
        {activeTab === 'inbound' && <Inbound />}
        
        {activeTab === 'outbound' && <div className="row justify-content-center"><div className="col-12 col-lg-10"><Outbound /></div></div>}
      </main>
    </div>
  );
}

export default App;