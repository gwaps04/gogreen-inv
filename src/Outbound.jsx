import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Outbound() {
  const [items, setItems] = useState([]);
  const [jobOrders, setJobOrders] = useState([]); // State for the new JO list
  const [formData, setFormData] = useState({
    inventory_id: '',
    quantity: 0,
    job_order_id: '' // Linking by ID instead of just a number string
  });

  useEffect(() => {
    fetchInventory();
    fetchJobOrders();
  }, []);

  const fetchInventory = async () => {
    const { data } = await supabase.from('inventory').select('id, item_name, qty');
    setItems(data || []);
  };

  const fetchJobOrders = async () => {
    // Fetches the JOs we created with the 0001 auto-numbering logic
    const { data } = await supabase
      .from('job_orders')
      .select('id, jo_number, person_in_charge')
      .order('created_at', { ascending: false });
    setJobOrders(data || []);
  };

  const handleOutbound = async (e) => {
    e.preventDefault();
    
    const selectedItem = items.find(i => i.id === parseInt(formData.inventory_id));
    
    if (selectedItem.qty < formData.quantity) {
      alert("Error: Not enough stock available!");
      return;
    }

    // 1. Record the movement and link it to the Job Order ID
    const { error: moveError } = await supabase.from('stock_movements').insert([
      { 
        inventory_id: formData.inventory_id,
        quantity: parseInt(formData.quantity),
        movement_type: 'OUT',
        job_order_id: formData.job_order_id // Linking to the formal JO record
      }
    ]);

    if (!moveError) {
      // 2. Update the main inventory quantity
      const newQty = selectedItem.qty - parseInt(formData.quantity);
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ qty: newQty })
        .eq('id', formData.inventory_id);

      if (!updateError) {
        alert("Stock reduced and linked to Job Order successfully!");
        setFormData({ inventory_id: '', quantity: 0, job_order_id: '' });
        fetchInventory();
      }
    } else {
      alert("Error recording movement: " + moveError.message);
    }
  };

  return (
    <div className="card shadow-sm border-0">
      <div className="card-header bg-white fw-bold text-danger">
        <i className="bi bi-box-arrow-right me-2"></i>Outbound (Stock Out)
      </div>
      <div className="card-body">
        <form onSubmit={handleOutbound}>
          {/* Item Selection */}
          <div className="mb-3">
            <label className="form-label fw-bold small">Select Material</label>
            <select className="form-select" required value={formData.inventory_id} 
              onChange={(e) => setFormData({...formData, inventory_id: e.target.value})}>
              <option value="">-- Choose Material --</option>
              {items.map(item => (
                <option key={item.id} value={item.id}>{item.item_name} (Stock: {item.qty})</option>
              ))}
            </select>
          </div>

          {/* Job Order Selection - Pulls from the JO Table */}
          <div className="mb-3">
            <label className="form-label fw-bold small">Link to Job Order</label>
            <select className="form-select" required value={formData.job_order_id} 
              onChange={(e) => setFormData({...formData, job_order_id: e.target.value})}>
              <option value="">-- Select Active JO # --</option>
              {jobOrders.map(job => (
                <option key={job.id} value={job.id}>
                  {job.jo_number} - {job.person_in_charge}
                </option>
              ))}
            </select>
          </div>

          {/* Quantity */}
          <div className="mb-3">
            <label className="form-label fw-bold small">Quantity to Pull</label>
            <input type="number" className="form-control" required min="1" value={formData.quantity}
              onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
          </div>

          <button type="submit" className="btn btn-danger w-100 fw-bold">
            Confirm Outbound
          </button>
        </form>
      </div>
    </div>
  );
}

export default Outbound;