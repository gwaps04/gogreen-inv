import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Outbound() {
  const [items, setItems] = useState([]);
  const [jobOrders, setJobOrders] = useState([]);
  const [selectedJO, setSelectedJO] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [pullQty, setPullQty] = useState(1);
  const [pickList, setPickList] = useState([]);

  // --- STATES FOR HISTORY SECTION ---
  const [outboundHistory, setOutboundHistory] = useState([]);
  const [expandedRows, setExpandedRows] = useState({});
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingJO, setEditingJO] = useState(null);
  const [editItems, setEditItems] = useState([]);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => { 
    fetchInventory(); 
    fetchJobOrders();
    fetchOutboundHistory();
  }, []);

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('id, item_name, qty');
    setItems(data || []);
  };

  const fetchJobOrders = async () => {
    const { data } = await supabase.from('job_orders').select('id, jo_number, person_in_charge').order('created_at', { ascending: false });
    setJobOrders(data || []);
  };

  const fetchOutboundHistory = async () => {
    const { data } = await supabase
      .from('job_orders')
      .select(`
        id, jo_number, person_in_charge,
        stock_movements (
          id, quantity, inventory_id,
          inventory ( id, item_name, qty )
        )
      `)
      .order('created_at', { ascending: false });
    setOutboundHistory(data?.filter(jo => jo.stock_movements.length > 0) || []);
  };

  // --- 1. NEW: LOGGING HELPER FUNCTION ---
  const logActivity = async (userEmail, type, description) => {
    await supabase.from('activity_logs').insert([{
      user_email: userEmail,
      action_type: type,
      description: description
    }]);
  };

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAddItem = () => {
    const mat = items.find(i => i.id === parseInt(selectedMaterial));
    if (!mat) return;
    if (mat.qty === 0) { alert("Action Blocked: OUT OF STOCK."); return; }
    if (mat.qty < 5) { alert(`Warning: ${mat.item_name} needs restocking!`); }

    if (mat.qty >= pullQty) {
      setPickList([...pickList, { inventory_id: mat.id, name: mat.item_name, requested_qty: parseInt(pullQty), current_stock: mat.qty }]);
      setSelectedMaterial(''); setPullQty(1);
    } else { alert("Insufficient Stock!"); }
  };

  const triggerAuth = (type, payload) => {
    setPendingAction({ type, payload });
    setShowPasswordModal(true);
  };

  const handleAuthorizedAction = async (e) => {
    e.preventDefault();
    setIsVerifying(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: confirmPassword });

    if (error) { alert("Verification Failed!"); setIsVerifying(false); return; }

    try {
      if (pendingAction.type === 'NEW') {
        for (const item of pickList) {
          await supabase.from('stock_movements').insert([{ inventory_id: item.inventory_id, quantity: item.requested_qty, movement_type: 'OUT', job_order_id: selectedJO }]);
          await supabase.from('inventory').update({ qty: item.current_stock - item.requested_qty }).eq('id', item.inventory_id);
        }
        setPickList([]); setSelectedJO('');
      } 
      
      else if (pendingAction.type === 'DELETE_MOVEMENT') {
        const move = pendingAction.payload;
        // Restoring stock
        await supabase.from('inventory').update({ qty: move.inventory.qty + move.quantity }).eq('id', move.inventory_id);
        await supabase.from('stock_movements').delete().eq('id', move.id);
        
        // 1. Log the deletion
        await logActivity(user.email, 'DELETE', `Deleted pull of ${move.quantity} ${move.inventory.item_name} from JO records.`);
      }

      else if (pendingAction.type === 'UPDATE_HISTORY') {
        for (const item of editItems) {
            if (item.hasChanged) {
                const diff = item.originalQty - item.currentQty;
                await supabase.from('inventory').update({ qty: item.inventory_qty + diff }).eq('id', item.inventory_id);
                await supabase.from('stock_movements').update({ quantity: item.currentQty }).eq('id', item.movement_id);
                
                // 1. Log the individual item change
                await logActivity(user.email, 'EDIT', `Adjusted ${item.name} quantity from ${item.originalQty} to ${item.currentQty} for JO: ${editingJO.jo_number}`);
            }
        }
        setShowEditModal(false);
      }

      alert("Authorized & Logged.");
      fetchInventory();
      fetchOutboundHistory();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setShowPasswordModal(false);
      setConfirmPassword('');
      setIsVerifying(false);
    }
  };

  const updatePickListQty = (id, newQty) => {
    const mat = items.find(i => i.id === id);
    if (newQty > mat.qty) { alert(`Insufficient Stock!`); return; }
    setPickList(pickList.map(p => p.inventory_id === id ? { ...p, requested_qty: parseInt(newQty) } : p));
  };

  return (
    <div className="row g-4 text-dark">
      {/* TOP SECTION */}
      <div className="col-12 col-lg-5">
        <div className="card shadow-sm border-0 p-4 h-100">
          <h5 className="fw-bold text-danger mb-4"><i className="bi bi-box-arrow-right me-2"></i>Prepare Stock-Out</h5>
          <label className="small fw-bold text-muted text-uppercase mb-2">Link to Job Order</label>
          <select className="form-select mb-4" value={selectedJO} onChange={(e) => setSelectedJO(e.target.value)}>
            <option value="">-- Select Active JO --</option>
            {jobOrders.map(job => <option key={job.id} value={job.id}>{job.jo_number} - {job.person_in_charge}</option>)}
          </select>
          <div className="bg-light p-3 rounded border">
            <select className="form-select mb-2" value={selectedMaterial} onChange={(e) => setSelectedMaterial(e.target.value)}>
              <option value="">-- Choose Material --</option>
              {items.map(i => <option key={i.id} value={i.id} disabled={pickList.some(p => p.inventory_id === i.id)}>{i.item_name} (Stock: {i.qty})</option>)}
            </select>
            <div className="input-group">
              <input type="number" className="form-control text-center" value={pullQty} onChange={(e) => setPullQty(e.target.value)} min="1" />
              <button className="btn btn-danger fw-bold" onClick={handleAddItem}>Add</button>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12 col-lg-7">
        <div className="card shadow-sm border-0 p-4 h-100">
          <h5 className="fw-bold mb-3">Material Pick List</h5>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead className="table-light small"><tr><th>Material Name</th><th className="text-center">Pull Qty</th><th className="text-end">Action</th></tr></thead>
              <tbody>
                {pickList.map(item => (
                  <tr key={item.inventory_id}>
                    <td className="fw-bold small">{item.name}</td>
                    <td><input type="number" className="form-control form-control-sm text-center border-danger" value={item.requested_qty} onChange={(e) => updatePickListQty(item.inventory_id, e.target.value)} /></td>
                    <td className="text-end"><button className="btn btn-sm text-danger" onClick={() => setPickList(pickList.filter(p => p.inventory_id !== item.inventory_id))}>&times;</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pickList.length > 0 && <button className="btn btn-danger w-100 fw-bold py-3 mt-3 shadow-sm" onClick={() => { if(!selectedJO) return alert("Select JO!"); triggerAuth('NEW'); }}>Finalize Stock-Out</button>}
        </div>
      </div>

      {/* HISTORY SECTION */}
      <div className="col-12 mt-4">
        <div className="card shadow-sm border-0 p-4">
          <h5 className="fw-bold mb-4 text-success"><i className="bi bi-clock-history me-2"></i>Outbound Job Order Records</h5>
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead className="table-light small text-uppercase">
                <tr><th>JO Number</th><th>Person In Charge</th><th style={{width: '35%'}}>Materials Pulled</th><th className="text-end">Actions</th></tr>
              </thead>
              <tbody>
                {outboundHistory.map(jo => {
                  const isExpanded = expandedRows[jo.id];
                  const displayedMovements = isExpanded ? jo.stock_movements : jo.stock_movements.slice(0, 1);
                  return (
                    <tr key={jo.id}>
                      <td className="fw-bold text-success">{jo.jo_number}</td>
                      <td className="small">{jo.person_in_charge}</td>
                      <td>
                        {displayedMovements.map(move => (
                          <div key={move.id} className="d-flex justify-content-between align-items-center bg-light p-2 mb-1 rounded border shadow-sm">
                            <span className="small fw-bold">{move.inventory?.item_name}</span>
                            <span className="badge bg-danger rounded-pill">{move.quantity}</span>
                          </div>
                        ))}
                        {jo.stock_movements.length > 1 && (
                          <button className="btn btn-link btn-sm text-success p-0 fw-bold mt-1 text-decoration-none shadow-none" onClick={() => toggleRow(jo.id)}>{isExpanded ? 'Show Less' : `See More (${jo.stock_movements.length - 1} more...)`}</button>
                        )}
                      </td>
                      <td className="text-end">
                        <div className="btn-group shadow-sm">
                          <button className="btn btn-sm btn-outline-primary" onClick={() => {
                            setEditingJO(jo);
                            setEditItems(jo.stock_movements.map(m => ({
                                movement_id: m.id, inventory_id: m.inventory.id, name: m.inventory.item_name, originalQty: m.quantity, currentQty: m.quantity, inventory_qty: m.inventory.qty, hasChanged: false
                            })));
                            setShowEditModal(true);
                          }}><i className="bi bi-pencil-square"></i></button>
                          <button className="btn btn-sm btn-outline-danger" onClick={() => {
                            if(confirm("Delete all outbound records for this JO?")) jo.stock_movements.forEach(m => triggerAuth('DELETE_MOVEMENT', m));
                          }}><i className="bi bi-trash3"></i></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.85)'}}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-primary text-white py-3"><h6 className="modal-title fw-bold">Edit Records: {editingJO?.jo_number}</h6><button type="button" className="btn-close btn-close-white shadow-none" onClick={() => setShowEditModal(false)}></button></div>
              <div className="modal-body p-4">
                <table className="table align-middle">
                  <thead><tr className="small text-muted"><th>Material</th><th className="text-center" style={{width: '150px'}}>Qty Pulled</th><th className="text-end">Action</th></tr></thead>
                  <tbody>
                    {editItems.map((item, idx) => (
                      <tr key={item.movement_id}>
                        <td className="fw-bold small">{item.name}</td>
                        <td>
                          <input type="number" className="form-control form-control-sm text-center border-primary fw-bold" value={item.currentQty} onChange={(e) => {
                            const newQty = parseInt(e.target.value) || 0;
                            if (item.inventory_qty === 0 && newQty > item.originalQty) { alert("Action Blocked: Restock required."); return; }
                            const newItems = [...editItems]; newItems[idx].currentQty = newQty; newItems[idx].hasChanged = true; setEditItems(newItems);
                          }} />
                        </td>
                        <td className="text-end"><button className="btn btn-sm text-danger border-0" onClick={() => { triggerAuth('DELETE_MOVEMENT', editingJO.stock_movements.find(m => m.id === item.movement_id)); setShowEditModal(false); }}><i className="bi bi-trash3"></i></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="modal-footer border-0 bg-light p-3"><button className="btn btn-link text-muted text-decoration-none" onClick={() => setShowEditModal(false)}>Cancel</button><button className="btn btn-primary fw-bold px-4" onClick={() => triggerAuth('UPDATE_HISTORY')}>Save Changes</button></div>
            </div>
          </div>
        </div>
      )}

      {/* SECURITY MODAL */}
      {showPasswordModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.9)'}}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-dark text-white py-2"><h6 className="modal-title small fw-bold">Verify Identity</h6></div>
              <form onSubmit={handleAuthorizedAction}>
                <div className="modal-body p-4 text-center">
                  <i className="bi bi-shield-lock text-warning fs-1 mb-2"></i>
                  <p className="small text-muted mb-3">Authorize this action with your password.</p>
                  <input type="password" className="form-control text-center border-success" placeholder="Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoFocus />
                </div>
                <div className="modal-footer border-0 p-2 bg-light d-flex justify-content-center">
                  <button type="submit" className="btn btn-success btn-sm fw-bold w-75" disabled={isVerifying}>{isVerifying ? 'Verifying...' : 'Confirm'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Outbound;