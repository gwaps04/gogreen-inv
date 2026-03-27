import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

const STATUS_CONFIG = {
  'Pending Approval': { color: 'warning', textColor: 'dark', locked: false }, 
  'Sourcing': { color: 'secondary', textColor: 'white', locked: false },      
  'Stock Ordered (In transit)': { color: 'info', textColor: 'white', locked: false },
  'Stock Order Arrived': { color: 'success', textColor: 'white', locked: true }, 
  'Stock Order Closed Inbound': { color: 'primary', textColor: 'white', locked: true }, 
  'Stock Order (cancelled)': { color: 'danger', textColor: 'white', locked: true } 
};

function StockOrders() {
  const [materials, setMaterials] = useState([]);
  const [orderItems, setOrderItems] = useState([]); 
  const [history, setHistory] = useState([]); 
  const [searchTerm, setSearchTerm] = useState(''); 
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [editItems, setEditItems] = useState([]);
  
  const [currentMaterial, setCurrentMaterial] = useState('');
  const [currentCategory, setCurrentCategory] = useState(''); 
  const [currentQty, setCurrentQty] = useState(1);
  const [userRole, setUserRole] = useState(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => { 
    fetchInitialData(); 
    fetchOrderHistory(); 
    getUserRole(); 
  }, []);

  const getUserRole = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserRole(user?.user_metadata?.role || 'user'); 
  };

  const fetchInitialData = async () => {
    const { data } = await supabase.from('materials').select('*');
    setMaterials(data || []);
  };

  const fetchOrderHistory = async () => {
    const { data } = await supabase
      .from('stock_orders')
      .select('*, stock_order_items(*, materials(*))')
      .order('created_at', { ascending: false });
    setHistory(data || []);
  };

  const getStatusCounts = () => {
    const counts = {};
    Object.keys(STATUS_CONFIG).forEach(status => counts[status] = 0);
    history.forEach(order => {
      if (counts[order.status] !== undefined) counts[order.status]++;
    });
    return counts;
  };

  const downloadPDF = (order) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("STOCK ORDER REQUISITION", 14, 22);
    doc.setFontSize(10);
    doc.text(`Order: ${order.order_number} | Status: ${order.status}`, 14, 32);
    
    const tableData = order.stock_order_items.map(item => [
      item.materials.material_name,
      item.materials.specs || 'N/A',
      item.category || 'N/A',
      item.quantity,
      item.materials.unit_of_measure
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Material', 'Specs', 'Category', 'Qty', 'Unit']],
      body: tableData,
      headStyles: { fillColor: [40, 167, 69] }
    });
    doc.save(`${order.order_number}.pdf`);
  };

  const syncToInventory = async (orderItems) => {
    for (const item of orderItems) {
      const { data: existing } = await supabase
        .from('inventory')
        .select('*')
        .eq('item_name', item.materials.material_name)
        .single();

      if (existing) {
        await supabase.from('inventory')
          .update({ qty: existing.qty + item.quantity })
          .eq('id', existing.id);
      } else {
        await supabase.from('inventory').insert([{
          item_name: item.materials.material_name,
          category: item.category,
          qty: item.quantity,
          item_type: item.materials.unit_of_measure,
          date_of_arrival: new Date().toISOString().split('T')[0]
        }]);
      }
    }
  };

  const handleStatusChangeAttempt = (order, newStatus) => {
    const criticalStatuses = ['Stock Order Closed Inbound', 'Stock Order (cancelled)'];
    if (criticalStatuses.includes(newStatus)) {
      setPendingStatusUpdate({ orderId: order.id, status: newStatus, fullOrder: order });
      setShowPasswordModal(true);
    } else {
      updateStatus(order.id, newStatus);
    }
  };

  const updateStatus = async (orderId, newStatus, fullOrder = null) => {
    const { error } = await supabase.from('stock_orders').update({ status: newStatus }).eq('id', orderId);
    if (error) {
        alert(error.message);
        fetchOrderHistory();
        return;
    }
    if (newStatus === 'Stock Order Closed Inbound') {
        const order = fullOrder || history.find(h => h.id === orderId);
        await syncToInventory(order.stock_order_items);
        alert("Inventory updated successfully!");
    } else if (newStatus === 'Stock Order (cancelled)') {
        alert("Order successfully cancelled.");
    }
    fetchOrderHistory();
  };

  const verifyAndSubmitStatus = async (e) => {
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
    await updateStatus(pendingStatusUpdate.orderId, pendingStatusUpdate.status, pendingStatusUpdate.fullOrder);
    setShowPasswordModal(false);
    setConfirmPassword('');
    setPendingStatusUpdate(null);
    setIsVerifying(false);
  };

  const handleDelete = async (orderId) => {
    if (userRole !== 'admin') {
      alert("Action Restricted: This requires approval from the administrator.");
      return;
    }
    if (confirm("Are you sure you want to delete this order?")) {
      const { error } = await supabase.from('stock_orders').delete().eq('id', orderId);
      if (error) alert(error.message);
      else fetchOrderHistory();
    }
  };

  // MENTOR NOTE: This function now auto-links category based on material selection
  const handleMaterialChange = (materialId) => {
    setCurrentMaterial(materialId);
    const mat = materials.find(m => m.id === parseInt(materialId));
    if (mat) {
        setCurrentCategory(mat.category); // Auto-set category from material master
    } else {
        setCurrentCategory('');
    }
  };

  const handleAddMaterialToOrder = () => {
    const mat = materials.find(m => m.id === parseInt(currentMaterial));
    if (!mat) {
      alert("Please select a Material.");
      return;
    }
    setOrderItems([...orderItems, { 
      material_id: mat.id, 
      name: mat.material_name, 
      qty: currentQty,
      category: currentCategory // Now fixed to the material master value
    }]);
    setCurrentMaterial(''); 
    setCurrentCategory(''); 
    setCurrentQty(1);
  };

  const finalizeOrder = async () => {
    const orderNo = `SO-${Date.now().toString().slice(-6)}`;
    const { data: { user } } = await supabase.auth.getUser();
    const { data: so, error: soError } = await supabase
        .from('stock_orders')
        .insert([{ 
            order_number: orderNo, 
            total_items: orderItems.length, 
            created_by: user.id, 
            status: 'Pending Approval' 
        }])
        .select();
    if (soError) {
        alert(soError.message);
        return;
    }
    const { error: itemsError } = await supabase
        .from('stock_order_items')
        .insert(orderItems.map(item => ({ 
            stock_order_id: so[0].id, 
            material_id: item.material_id, 
            quantity: item.qty,
            category: item.category 
        })));
    if (itemsError) {
        alert(itemsError.message);
    } else {
        setOrderItems([]); 
        fetchOrderHistory(); 
        alert("Order Created!");
    }
  };

  const updateOrder = async () => {
    if (STATUS_CONFIG[editingOrder.status].locked) return; 
    await supabase.from('stock_order_items').delete().eq('stock_order_id', editingOrder.id);
    await supabase.from('stock_order_items').insert(editItems.map(item => ({ 
      stock_order_id: editingOrder.id, 
      material_id: item.material_id, 
      quantity: item.qty,
      category: item.category 
    })));
    await supabase.from('stock_orders').update({ total_items: editItems.length }).eq('id', editingOrder.id);
    setShowEditModal(false);
    fetchOrderHistory();
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="row g-4 text-dark">
      <div className="col-12">
        <div className="row g-2 mb-2">
          {Object.entries(STATUS_CONFIG).map(([status, style]) => (
            <div key={status} className="col-6 col-md-4 col-lg-2">
              <div className={`card border-0 shadow-sm bg-${style.color} text-${style.textColor} p-2 text-center`}>
                <div className="small fw-bold opacity-75">{status}</div>
                <div className="h4 m-0 fw-bold">{statusCounts[status] || 0}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-12 col-lg-4">
        <div className="card shadow-sm border-0 p-4 h-100">
          <h5 className="fw-bold text-success mb-4">Create New Order</h5>
          <div className="p-3 bg-light rounded border mb-3">
            <label className="small fw-bold text-muted text-uppercase mb-1">Select Material *</label>
            <select className="form-select mb-2" value={currentMaterial} onChange={(e) => handleMaterialChange(e.target.value)}>
              <option value="">-- Choose Item --</option>
              {materials.map(m => <option key={m.id} value={m.id}>{m.material_name}</option>)}
            </select>

            {/* Situation 1: Category dropdown is now disabled to prevent manual changes */}
            <label className="small fw-bold text-muted text-uppercase mb-1 mt-2">Designated Category</label>
            <select className="form-select mb-2 bg-light shadow-none" value={currentCategory} disabled>
              <option value="">{currentCategory || '-- No Category --'}</option>
              <option value="Consumables">Consumables</option>
              <option value="Outdoor">Outdoor</option>
              <option value="Indoor">Indoor</option>
              <option value="Protective Devices">Protective Devices</option>
            </select>

            <div className="input-group mt-3">
              <span className="input-group-text bg-white small">Qty</span>
              <input type="number" className="form-control" value={currentQty || ''} onChange={(e) => setCurrentQty(parseInt(e.target.value) || 0)} min="1" />
              <button className="btn btn-success fw-bold px-3" onClick={handleAddMaterialToOrder}>Add</button>
            </div>
          </div>
          <div className="list-group list-group-flush mb-3 overflow-auto" style={{maxHeight: '300px'}}>
            {orderItems.map((item, i) => (
              <div key={i} className="list-group-item d-flex justify-content-between align-items-center py-2 px-0">
                <div>
                  <div className="small fw-bold">{item.name} ({item.qty})</div>
                  <div className="small text-muted" style={{fontSize: '0.7rem'}}>{item.category}</div>
                </div>
                <button className="btn btn-sm text-danger p-0" onClick={() => setOrderItems(orderItems.filter((_, idx) => idx !== i))}>&times;</button>
              </div>
            ))}
          </div>
          {orderItems.length > 0 && <button className="btn btn-success w-100 fw-bold py-2 shadow-sm" onClick={finalizeOrder}>Finalize Order</button>}
        </div>
      </div>

      <div className="col-12 col-lg-8">
        <div className="card shadow-sm border-0 p-4">
          <h5 className="fw-bold mb-4">Order History</h5>
          <div className="table-responsive">
            <table className="table align-middle table-hover">
              <thead className="table-light small fw-bold text-uppercase">
                <tr><th>Order No.</th><th>Status</th><th className="text-end">Actions</th></tr>
              </thead>
              <tbody>
                {history.filter(h => h.order_number.toLowerCase().includes(searchTerm.toLowerCase())).map(h => {
                  const isLocked = STATUS_CONFIG[h.status]?.locked;
                  const isTerminal = h.status === 'Stock Order Closed Inbound' || h.status === 'Stock Order (cancelled)'; 
                  return (
                    <tr key={h.id}>
                      <td>
                        <button className="btn btn-link p-0 text-success fw-bold text-decoration-none" onClick={() => { 
                          setEditingOrder(h); 
                          setEditItems(h.stock_order_items.map(i => ({ 
                            material_id: i.material_id, 
                            name: i.materials.material_name, 
                            qty: i.quantity,
                            category: i.category 
                          }))); 
                          setShowEditModal(true); 
                        }}>
                          {h.order_number} {isLocked && <i className="bi bi-lock-fill ms-1 small text-muted"></i>}
                        </button>
                      </td>
                      <td>
                        <select 
                          className={`form-select form-select-sm fw-bold border-0 bg-${STATUS_CONFIG[h.status]?.color} text-${STATUS_CONFIG[h.status]?.textColor}`}
                          value={h.status}
                          disabled={isTerminal} 
                          onChange={(e) => handleStatusChangeAttempt(h, e.target.value)}
                        >
                          {Object.keys(STATUS_CONFIG).map(status => (
                            <option key={status} value={status} className="bg-white text-dark">{status}</option>
                          ))}
                        </select>
                      </td>
                      <td className="text-end">
                        <button className="btn btn-sm btn-outline-primary border-0 me-2" onClick={() => downloadPDF(h)}><i className="bi bi-file-earmark-pdf-fill"></i></button>
                        <button className="btn btn-sm btn-outline-danger border-0" disabled={isLocked} onClick={() => handleDelete(h.id)}>
                          <i className="bi bi-trash3-fill"></i>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* VERIFICATION MODAL remains unchanged */}
      {showPasswordModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.85)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">Critical Authorization</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => { setShowPasswordModal(false); fetchOrderHistory(); }}></button>
              </div>
              <form onSubmit={verifyAndSubmitStatus}>
                <div className="modal-body p-4 text-center">
                  <i className={`bi ${pendingStatusUpdate?.status.includes('cancel') ? 'bi-exclamation-octagon-fill text-danger' : 'bi-shield-lock-fill text-warning'} mb-3`} style={{fontSize: '3.5rem'}}></i>
                  <h6 className="fw-bold">Authorize Action?</h6>
                  <p className="small text-muted mb-4">Order: <b>{pendingStatusUpdate?.fullOrder?.order_number}</b></p>
                  <input type="password" className="form-control text-center py-2 border-dark" placeholder="Enter Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoFocus />
                </div>
                <div className="modal-footer border-0 p-3 bg-light">
                  <button type="button" className="btn btn-link text-muted text-decoration-none" onClick={() => { setShowPasswordModal(false); fetchOrderHistory(); }}>Cancel</button>
                  <button type="submit" className={`btn ${pendingStatusUpdate?.status.includes('cancel') ? 'btn-danger' : 'btn-success'} fw-bold px-4`} disabled={isVerifying}>
                    {isVerifying ? 'Verifying...' : 'Authorize'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* EDIT MODAL: Category logic also locked here */}
      {showEditModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)'}}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-success text-white py-3">
                <h5 className="modal-title fw-bold text-white">Order Details: {editingOrder?.order_number}</h5>
                <button type="button" className="btn-close btn-close-white shadow-none" onClick={() => setShowEditModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                {STATUS_CONFIG[editingOrder.status].locked && (
                    <div className="alert alert-info small py-2 fw-bold">
                        <i className="bi bi-info-circle-fill me-2"></i> 
                        Record Locked: This order is in a final state and cannot be modified.
                    </div>
                )}
                {!STATUS_CONFIG[editingOrder.status].locked && (
                    <div className="row g-2 mb-4 bg-light p-2 rounded">
                        <div className="col-md-7">
                            <select className="form-select form-select-sm" value={currentMaterial} onChange={(e) => handleMaterialChange(e.target.value)}>
                                <option value="">-- Add Material --</option>
                                {materials.map(m => <option key={m.id} value={m.id}>{m.material_name}</option>)}
                            </select>
                        </div>
                        <div className="col-md-3">
                            {/* Disabled Category in Edit Modal */}
                            <select className="form-select form-select-sm bg-light shadow-none" value={currentCategory} disabled>
                                <option value="">{currentCategory || 'Category'}</option>
                            </select>
                        </div>
                        <div className="col-md-2">
                            <button className="btn btn-sm btn-success w-100 fw-bold" onClick={handleAddMaterialToOrder}>Add</button>
                        </div>
                    </div>
                )}
                <table className="table align-middle">
                  <thead><tr className="small text-muted text-uppercase"><th>Material</th><th>Category</th><th style={{width: '100px'}}>Qty</th>{!STATUS_CONFIG[editingOrder.status].locked && <th className="text-end">Action</th>}</tr></thead>
                  <tbody>
                    {editItems.map((item, i) => (
                        <tr key={i}>
                            <td className="fw-bold small">{item.name}</td>
                            <td className="small text-muted">{item.category}</td>
                            <td>
                                <input type="number" className="form-control form-control-sm text-center" 
                                    value={item.qty} 
                                    disabled={STATUS_CONFIG[editingOrder.status].locked}
                                    onChange={(e) => {
                                        const newItems = [...editItems]; newItems[i].qty = parseInt(e.target.value) || 0; setEditItems(newItems);
                                    }} />
                            </td>
                            {!STATUS_CONFIG[editingOrder.status].locked && (
                                <td className="text-end"><button className="btn btn-sm text-danger border-0" onClick={() => setEditItems(editItems.filter((_, idx) => idx !== i))}>&times;</button></td>
                            )}
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer border-0 p-3 bg-light">
                <button className="btn btn-link text-muted text-decoration-none" onClick={() => setShowEditModal(false)}>Close</button>
                {!STATUS_CONFIG[editingOrder.status].locked && (
                    <button className="btn btn-success fw-bold px-4 py-2" onClick={updateOrder}>Save Changes</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default StockOrders;