import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
// 1. SITUATION: Import PDF libraries
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function InventoryList() {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);
  const [userRole, setUserRole] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => { 
    fetchInventory(); 
    getUserRole(); 
  }, []);

  const getUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserRole(user?.user_metadata?.role || 'user'); 
  };

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('qty', { ascending: true }); 
      
    if (error) console.error('Error:', error);
    else setInventory(data || []);
    setLoading(false);
  };

  // 1. SITUATION: PDF Generation Logic
  const downloadInventoryReport = () => {
    const doc = new jsPDF();
    
    // Header Section
    doc.setFontSize(18);
    doc.text("GO GREEN SOLAR - INVENTORY REPORT", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 28);
    doc.text(`Total Items Tracked: ${inventory.length}`, 14, 34);

    // Prepare table data from existing inventory state
    const tableData = inventory.map(item => {
      // Logic for Status text
      let status = "HEALTHY";
      if (item.qty === 0) status = "OUT OF STOCK";
      else if (item.qty < 5) status = "LOW STOCK";

      return [
        item.item_name,
        item.classification || 'N/A',
        item.category || 'N/A',
        item.qty,
        status
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['Material Name', 'Classification', 'Category', 'Qty', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [25, 135, 84] }, // Success Green
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'center' },
        4: { fontStyle: 'bold' }
      }
    });

    doc.save(`Inventory_Report_${Date.now()}.pdf`);
  };

  const handleDeleteAttempt = (id) => {
    if (userRole !== 'admin') {
      alert("Permission Denied: Only an Administrator can delete inventory items.");
      return;
    }
    setPendingAction({ type: 'DELETE', payload: id });
    setShowPasswordModal(true);
  };

  const handleUpdateAttempt = (e) => {
    e.preventDefault();
    if (userRole !== 'admin') {
      alert("Permission Denied: Only an Administrator can apply inventory changes.");
      setEditingItem(null);
      return;
    }
    setPendingAction({ type: 'UPDATE', payload: editingItem });
    setShowPasswordModal(true);
  };

  const verifyAndExecute = async (e) => {
    e.preventDefault();
    setIsVerifying(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: confirmPassword,
    });

    if (error) {
      alert("Verification Failed: Incorrect password.");
      setIsVerifying(false);
      return;
    }

    try {
      if (pendingAction.type === 'DELETE') {
        await supabase.from('inventory').delete().eq('id', pendingAction.payload);
      } else if (pendingAction.type === 'UPDATE') {
        await supabase.from('inventory').update(pendingAction.payload).eq('id', pendingAction.payload.id);
        setEditingItem(null);
      }
      fetchInventory();
    } catch (err) {
      alert("Database error: " + err.message);
    } finally {
      closeSecurityModal();
    }
  };

  const closeSecurityModal = () => {
    setShowPasswordModal(false);
    setConfirmPassword('');
    setIsVerifying(false);
    setPendingAction(null);
  };

  const getBadgeClass = (category) => {
    switch (category) {
      case 'Consumables': return 'bg-warning text-dark border-warning';
      case 'Outdoor': return 'bg-primary text-white border-primary';
      case 'Indoor': return 'bg-info text-dark border-info';
      case 'Protective Devices': return 'bg-dark text-white border-dark';
      default: return 'bg-light text-dark border-secondary';
    }
  };

  if (loading) return <div className="text-center mt-5 py-5"><div className="spinner-border text-success"></div></div>;

  const filteredInventory = inventory.filter(i => i.item_name.toLowerCase().includes(searchTerm.toLowerCase()));

  const lowStockItems = inventory.filter(i => i.qty > 0 && i.qty < 5);
  const outOfStockItems = inventory.filter(i => i.qty === 0);

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white py-3 border-bottom-0">
        <div className="row align-items-center g-3">
          <div className="col-12 col-md-5">
            <h5 className="mb-0 fw-bold text-success"><i className="bi bi-box-seam me-2"></i>Current Stock Levels</h5>
          </div>
          <div className="col-12 col-md-4">
            <input type="text" className="form-control" placeholder="Search Material Name..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="col-12 col-md-3">
            {/* 1. SITUATION: Added PDF download button */}
            <button 
                className="btn btn-outline-success w-100 fw-bold shadow-sm" 
                onClick={downloadInventoryReport}
                disabled={inventory.length === 0}
            >
                <i className="bi bi-file-earmark-pdf-fill me-2"></i>Export List
            </button>
          </div>
        </div>
      </div>

      {(lowStockItems.length > 0 || outOfStockItems.length > 0) && (
        <div className="px-4 pt-2">
            {outOfStockItems.length > 0 && (
                <div className="alert alert-dark border-0 py-2 small d-flex align-items-center mb-2">
                    <i className="bi bi-exclamation-octagon-fill text-danger me-2"></i>
                    <span className="fw-bold text-danger">OUT OF STOCK:</span> &nbsp; {outOfStockItems.map(i => i.item_name).join(', ')}
                </div>
            )}
            {lowStockItems.length > 0 && (
                <div className="alert alert-warning border-0 py-2 small d-flex align-items-center">
                    <i className="bi bi-arrow-repeat text-warning me-2"></i>
                    <span className="fw-bold">RE-STOCK SOON:</span> &nbsp; {lowStockItems.map(i => i.item_name).join(', ')}
                </div>
            )}
        </div>
      )}

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0" style={{ minWidth: '800px' }}>
          <thead className="table-light">
            <tr className="small text-muted text-uppercase">
              <th className="ps-4">Material Name</th>
              <th>Classification / Category</th>
              <th className="text-center">Qty Levels</th>
              <th className="text-center">Status</th>
              <th className="text-end pe-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.length === 0 ? (
              <tr><td colSpan="5" className="text-center py-5"><p className="text-muted fw-bold">Data is not yet available.</p></td></tr>
            ) : (
              filteredInventory.map((item) => (
                <tr key={item.id} className={item.qty === 0 ? 'bg-light opacity-75' : ''}>
                  {editingItem && editingItem.id === item.id ? (
                    <td colSpan="5" className="bg-light p-3">
                      <form onSubmit={handleUpdateAttempt} className="row g-3">
                        <div className="col-12 col-md-4">
                          <label className="small fw-bold text-muted">Material Name</label>
                          <input type="text" className="form-control" value={editingItem.item_name} onChange={(e) => setEditingItem({...editingItem, item_name: e.target.value})} required />
                        </div>
                        <div className="col-6 col-md-2">
                          <label className="small fw-bold text-muted">Category</label>
                          <select className="form-select" value={editingItem.category} onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}>
                            <option value="Outdoor">Outdoor</option><option value="Indoor">Indoor</option><option value="Consumables">Consumables</option><option value="Protective Devices">Protective Devices</option>
                          </select>
                        </div>
                        <div className="col-6 col-md-2">
                          <label className="small fw-bold text-muted">Qty</label>
                          <input type="number" className="form-control" value={editingItem.qty} onChange={(e) => setEditingItem({...editingItem, qty: parseInt(e.target.value) || 0})} required />
                        </div>
                        <div className="col-12 col-md-4 d-flex align-items-end justify-content-md-end">
                          <button type="submit" className="btn btn-success me-2 px-3 fw-bold">Save</button>
                          <button type="button" className="btn btn-outline-secondary px-3" onClick={() => setEditingItem(null)}>Cancel</button>
                        </div>
                      </form>
                    </td>
                  ) : (
                    <>
                      <td className="ps-4">
                        <div className="fw-bold text-dark">{item.item_name}</div>
                        <div className="small text-muted text-uppercase" style={{ fontSize: '0.75rem' }}>{item.item_type || 'General'}</div>
                      </td>
                      <td>
                        <div className="badge bg-info text-dark me-2" style={{fontSize: '0.7rem'}}>{item.classification || 'N/A'}</div>
                        <span className={`badge border px-2 py-1 shadow-sm ${getBadgeClass(item.category)}`}>{item.category || 'N/A'}</span>
                      </td>
                      <td className="text-center">
                        <span className={`badge rounded-pill py-2 px-3 ${item.qty === 0 ? 'bg-dark' : item.qty < 5 ? 'bg-danger' : 'bg-success'}`}>
                          {item.qty}
                        </span>
                      </td>
                      <td className="text-center">
                        {item.qty === 0 ? <span className="text-danger fw-bold small">OUT OF STOCK</span> : item.qty < 5 ? <span className="text-warning fw-bold small">LOW STOCK</span> : <span className="text-success fw-bold small">HEALTHY</span>}
                      </td>
                      <td className="text-end pe-4">
                        <div className="btn-group shadow-sm">
                          <button className={`btn btn-sm btn-outline-primary border-end-0 ${userRole !== 'admin' ? 'opacity-50' : ''}`} onClick={() => setEditingItem({...item})} title="Edit"><i className="bi bi-pencil-square"></i></button>
                          <button className={`btn btn-sm btn-outline-danger ${userRole !== 'admin' ? 'opacity-50' : ''}`} onClick={() => handleDeleteAttempt(item.id)} title="Delete"><i className="bi bi-trash3"></i></button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Security Modal Unchanged */}
      {showPasswordModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.8)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-dark text-white py-3">
                <h6 className="modal-title fw-bold"><i className="bi bi-shield-lock-fill me-2 text-warning"></i>Authorization Required</h6>
                <button type="button" className="btn-close btn-close-white" onClick={closeSecurityModal}></button>
              </div>
              <form onSubmit={verifyAndExecute}>
                <div className="modal-body p-4 text-center">
                  <p className="fw-bold mb-1">Administrator Verification</p>
                  <p className="small text-muted mb-4">Please confirm your administrator password to modify inventory records.</p>
                  <input type="password" className="form-control form-control-lg text-center border-success" placeholder="Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoFocus />
                </div>
                <div className="modal-footer border-0 p-3 bg-light">
                  <button type="button" className="btn btn-link text-muted text-decoration-none" onClick={closeSecurityModal}>Cancel</button>
                  <button type="submit" className="btn btn-success fw-bold px-4" disabled={isVerifying}>{isVerifying ? 'Verifying...' : 'Authorize Action'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryList;