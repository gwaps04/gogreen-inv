import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function JobOrders() {
  const [jobOrders, setJobOrders] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Single state for the form (Used for both Create and Edit)
  const [formData, setFormData] = useState({
    full_address: '', 
    person_in_charge: '', 
    scheduled_date: new Date().toISOString().split('T')[0]
  });
  
  const [itemEdits, setItemEdits] = useState([]);

  useEffect(() => { fetchJobs(); }, []);

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from('job_orders')
      .select(`
        *,
        stock_movements (
          id,
          quantity,
          inventory_id,
          inventory ( item_name, qty )
        )
      `)
      .order('created_at', { ascending: false });

    if (error) console.error("Error:", error);
    else setJobOrders(data || []);
  };

  // --- CREATE OR UPDATE LOGIC ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (editingId) {
      // 1. UPDATE EXISTING JOB
      const { error: joError } = await supabase.from('job_orders').update(formData).eq('id', editingId);
      if (joError) return alert(joError.message);

      // Process quantity reconciliation
      for (const item of itemEdits) {
        if (item.old_qty !== item.new_qty) {
          const difference = item.old_qty - item.new_qty; 
          const finalInventoryQty = item.current_stock + difference;
          if (finalInventoryQty < 0) {
            alert(`Insufficient stock for ${item.item_name}!`);
            continue;
          }
          await supabase.from('stock_movements').update({ quantity: item.new_qty }).eq('id', item.movement_id);
          await supabase.from('inventory').update({ qty: finalInventoryQty }).eq('id', item.inventory_id);
        }
      }
      alert("Job Order Updated!");
    } else {
      // 2. CREATE NEW JOB
      const { error } = await supabase.from('job_orders').insert([formData]);
      if (error) alert(error.message);
      else alert("New Job Order Created!");
    }

    setEditingId(null);
    setFormData({ full_address: '', person_in_charge: '', scheduled_date: new Date().toISOString().split('T')[0] });
    fetchJobs();
  };

  const handleEdit = (job) => {
    setEditingId(job.id);
    setFormData({ 
      full_address: job.full_address, 
      person_in_charge: job.person_in_charge, 
      scheduled_date: job.scheduled_date 
    });
    setItemEdits(job.stock_movements.map(m => ({
      movement_id: m.id,
      inventory_id: m.inventory_id,
      old_qty: m.quantity,
      new_qty: m.quantity,
      item_name: m.inventory.item_name,
      current_stock: m.inventory.qty
    })));
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete JO? (Note: Items will not be automatically returned to stock).")) {
      await supabase.from('job_orders').delete().eq('id', id);
      fetchJobs();
    }
  };

  const filteredJobs = jobOrders.filter(j => 
    j.person_in_charge.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.jo_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="row g-4">
      {/* LEFT PANEL: ADAPTIVE FORM */}
      <div className="col-md-4">
        <div className="card shadow-sm border-0 p-3 sticky-top" style={{ top: '20px' }}>
          <h5 className={`fw-bold ${editingId ? 'text-primary' : 'text-success'}`}>
            {editingId ? <><i className="bi bi-pencil-square me-2"></i>Edit Job Order</> : <><i className="bi bi-plus-circle me-2"></i>New Job Order</>}
          </h5>
          <hr />
          <form onSubmit={handleSubmit}>
            <div className="mb-2">
              <label className="small fw-bold">Site Address</label>
              <textarea className="form-control" rows="2" value={formData.full_address} onChange={(e) => setFormData({...formData, full_address: e.target.value})} required />
            </div>
            <div className="mb-2">
              <label className="small fw-bold">Person in Charge</label>
              <input type="text" className="form-control" value={formData.person_in_charge} onChange={(e) => setFormData({...formData, person_in_charge: e.target.value})} required />
            </div>
            <div className="mb-3">
              <label className="small fw-bold">Date</label>
              <input type="date" className="form-control" value={formData.scheduled_date} onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})} required />
            </div>

            {/* If Editing, show item quantity controls */}
            {editingId && itemEdits.length > 0 && (
              <div className="mb-3">
                <label className="small fw-bold text-primary mb-2">Adjust Quantities:</label>
                {itemEdits.map((item, idx) => (
                  <div key={idx} className="mb-2 p-2 bg-light border rounded">
                    <small className="d-block fw-bold">{item.item_name}</small>
                    <input type="number" className="form-control form-control-sm" value={item.new_qty} 
                      onChange={(e) => {
                        const updated = [...itemEdits];
                        updated[idx].new_qty = parseInt(e.target.value) || 0;
                        setItemEdits(updated);
                      }} 
                    />
                  </div>
                ))}
              </div>
            )}

            <button className={`btn w-100 fw-bold ${editingId ? 'btn-primary' : 'btn-success'}`}>
              {editingId ? 'Save Changes' : 'Generate Job Order'}
            </button>
            {editingId && (
              <button type="button" className="btn btn-link w-100 text-muted mt-2" onClick={() => {setEditingId(null); setFormData({full_address: '', person_in_charge: '', scheduled_date: new Date().toISOString().split('T')[0]})}}>
                Cancel Edit
              </button>
            )}
          </form>
        </div>
      </div>

      {/* RIGHT PANEL: SEARCH & TABLE */}
      <div className="col-md-8">
        <div className="card shadow-sm border-0 mb-3">
          <div className="card-body py-2">
            <div className="input-group">
              <span className="input-group-text bg-white border-0"><i className="bi bi-search"></i></span>
              <input type="text" className="form-control border-0 shadow-none" placeholder="Search by JO# or Person..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
        </div>
        
        <div className="card shadow-sm border-0 overflow-hidden">
          <table className="table align-middle mb-0">
            <thead className="table-light">
              <tr><th>JO # & Materials</th><th>Project Details</th><th className="text-end">Actions</th></tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr><td colSpan="3" className="text-center py-5 text-muted">No records found.</td></tr>
              ) : (
                filteredJobs.map(job => (
                  <tr key={job.id}>
                    <td>
                      <div className="fw-bold text-success">{job.jo_number}</div>
                      <div className="mt-2">
                        {job.stock_movements.map((m, i) => (
                          <div key={i} className="small text-muted border-start ps-2 mb-1">
                            {m.inventory.item_name} <span className="badge bg-secondary rounded-pill">{m.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="fw-bold">{job.person_in_charge}</div>
                      <div className="small text-muted">{job.full_address}</div>
                      <div className="small text-muted"><i className="bi bi-calendar me-1"></i>{job.scheduled_date}</div>
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={() => handleEdit(job)}><i className="bi bi-pencil"></i></button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(job.id)}><i className="bi bi-trash"></i></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default JobOrders;