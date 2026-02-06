import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Suppliers from './Suppliers';
import Outbound from './Outbound';
import InventoryList from './InventoryList';
import Login from './Login';
import JobOrders from './JobOrders'; // [New Import]

function App() {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [suppliersList, setSuppliersList] = useState([]);

  const [formData, setFormData] = useState({
    item_name: '', category: 'Outdoor', qty: 0, item_type: '', size_dimension: '', supplier_id: ''
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('id, supplier_name');
    setSuppliersList(data || []);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleInbound = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('inventory').insert([{ 
      ...formData, 
      qty: parseInt(formData.qty),
      date_of_arrival: new Date().toISOString().split('T')[0]
    }]);
    if (error) alert(error.message);
    else {
      alert("Material Recorded!");
      setFormData({ item_name: '', category: 'Outdoor', qty: 0, item_type: '', size_dimension: '', supplier_id: '' });
      setActiveTab('dashboard');
    }
  };

  if (!session) return <Login onLoginSuccess={(user) => setSession(user)} />;

  return (
    <div className="min-vh-100 bg-light">
      <nav className="navbar navbar-expand-lg navbar-dark bg-success shadow">
        <div className="container">
          <span className="navbar-brand fw-bold"><i className="bi bi-sun-fill me-2"></i>Go Green Solar</span>
          <div className="navbar-nav ms-auto flex-row">
            <button className={`nav-link border-0 bg-transparent me-2 ${activeTab === 'dashboard' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
            <button className={`nav-link border-0 bg-transparent me-2 ${activeTab === 'joborders' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('joborders')}>Job Orders</button>
            <button className={`nav-link border-0 bg-transparent me-2 ${activeTab === 'inbound' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('inbound')}>Inbound</button>
            <button className={`nav-link border-0 bg-transparent me-2 ${activeTab === 'outbound' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('outbound')}>Outbound</button>
            <button className={`nav-link border-0 bg-transparent me-2 ${activeTab === 'suppliers' ? 'active fw-bold' : ''}`} onClick={() => setActiveTab('suppliers')}>Suppliers</button>
            <button className="btn btn-sm btn-outline-light ms-2" onClick={handleLogout}>Logout</button>
          </div>
        </div>
      </nav>

      <main className="container mt-5 pb-5">
        {activeTab === 'dashboard' && <InventoryList />}
        {activeTab === 'joborders' && <JobOrders />} {/* [New Tab Content] */}
        {activeTab === 'inbound' && (
           /* ... existing inbound form from your code ... */
           <div className="row">
            <div className="col-md-8 mx-auto">
              <h1 className="display-6 fw-bold text-center mb-4">Materials Inbound</h1>
              <div className="card shadow-sm border-0 p-4">
                <form onSubmit={handleInbound}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Item Name</label>
                      <input type="text" name="item_name" className="form-control" value={formData.item_name} onChange={handleChange} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Category</label>
                      <select name="category" className="form-select" value={formData.category} onChange={handleChange}>
                        <option value="Outdoor">Outdoor</option>
                        <option value="Indoor">Indoor</option>
                        <option value="Metal_Enclosure">Metal Enclosure</option>
                        <option value="Consumables">Consumables</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Supplier</label>
                      <select name="supplier_id" className="form-select" value={formData.supplier_id} onChange={handleChange}>
                        <option value="">-- Select Supplier --</option>
                        {suppliersList.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Quantity</label>
                      <input type="number" name="qty" className="form-control" value={formData.qty} onChange={handleChange} required />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label">Type</label>
                      <input type="text" name="item_type" className="form-control" value={formData.item_type} onChange={handleChange} />
                    </div>
                    <div className="col-12 mt-4">
                      <button type="submit" className="btn btn-success w-100">Add to Inventory</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'outbound' && <div className="row"><div className="col-md-8 mx-auto"><Outbound /></div></div>}
        {activeTab === 'suppliers' && <Suppliers />}
      </main>
    </div>
  );
}

export default App;