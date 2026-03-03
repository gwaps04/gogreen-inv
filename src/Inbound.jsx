import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Inbound() {
  const [stockOrders, setStockOrders] = useState([]);
  const [masterMaterials, setMasterMaterials] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderNo, setSelectedOrderNo] = useState('');
  
  // 4. Situation: The grid for fresh entries
  const [verificationList, setVerificationList] = useState([]); 
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchArrivedOrders();
    fetchMaterialMaster();
  }, []);

  const fetchArrivedOrders = async () => {
    const { data } = await supabase
      .from('stock_orders')
      .select('id, order_number')
      .eq('status', 'Stock Order Arrived');
    setStockOrders(data || []);
  };

  // 3. Situation: Fetch data from Materials Database for dropdowns
  const fetchMaterialMaster = async () => {
    const { data } = await supabase.from('materials').select('material_name, classification, category, unit_of_measure');
    setMasterMaterials(data || []);
  };

  const handleOrderSelection = (e) => {
    const orderId = e.target.value;
    const orderObj = stockOrders.find(o => o.id === parseInt(orderId));
    
    setSelectedOrderId(orderId);
    setSelectedOrderNo(orderObj ? orderObj.order_number : '');

    if (orderId) {
      // Initialize with one empty row instead of copying from stock_order_items
      setVerificationList([{ 
        material_name: '', classification: '', category: '', arrived_qty: 0, unit: '' 
      }]);
    } else {
      setVerificationList([]);
    }
  };

  // 4. Situation: + icon logic to add rows
  const addRow = () => {
    setVerificationList([...verificationList, { 
      material_name: '', classification: '', category: '', arrived_qty: 0, unit: '' 
    }]);
  };

  const removeRow = (index) => {
    const updatedList = verificationList.filter((_, i) => i !== index);
    setVerificationList(updatedList);
  };

  const handleInputChange = (index, field, value) => {
    const updatedList = [...verificationList];
    
    // Auto-fill classification, category, and unit if a material is selected
    if (field === 'material_name') {
        const match = masterMaterials.find(m => m.material_name === value);
        if (match) {
            updatedList[index].classification = match.classification;
            updatedList[index].category = match.category;
            updatedList[index].unit = match.unit_of_measure;
        }
    }
    
    updatedList[index][field] = value;
    setVerificationList(updatedList);
  };

  const processInbound = async () => {
    if (verificationList.some(item => !item.material_name || item.arrived_qty <= 0)) {
        alert("Please ensure all rows have a Material Name and Quantity.");
        return;
    }

    if (!window.confirm(`Save these entries to Inventory under ${selectedOrderNo}?`)) return;

    for (const item of verificationList) {
      // Check if item exists in inventory
      const { data: existing } = await supabase
        .from('inventory')
        .select('*')
        .eq('item_name', item.material_name)
        .eq('category', item.category)
        .single();

      if (existing) {
        await supabase.from('inventory')
          .update({ 
            qty: existing.qty + parseInt(item.arrived_qty),
            reference_so: selectedOrderNo, // 2. Situation: Copy SO to reference
            classification: item.classification 
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('inventory').insert([{
          item_name: item.material_name,
          category: item.category,
          classification: item.classification,
          qty: parseInt(item.arrived_qty),
          item_type: item.unit,
          reference_so: selectedOrderNo, // 2. Situation: Copy SO to reference
          date_of_arrival: new Date().toISOString().split('T')[0]
        }]);
      }
    }

    // Lock the Stock Order
    await supabase.from('stock_orders').update({ status: 'Stock Order Closed Inbound' }).eq('id', selectedOrderId);
    
    alert(`Success: Items recorded under reference ${selectedOrderNo}.`);
    setSelectedOrderId('');
    setVerificationList([]);
    fetchArrivedOrders();
  };

  // Get unique lists for dropdowns from Master Data
  const uniqueClassifications = [...new Set(masterMaterials.map(m => m.classification))];
  const uniqueCategories = ["Consumables", "Indoor", "Outdoor", "Protective Devices"];

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-12">
        <div className="card shadow-sm border-0 p-4">
          <h4 className="fw-bold text-success mb-4">Manual Inbound Entry</h4>
          
          <div className="mb-4 bg-light p-3 rounded border">
            <label className="small fw-bold text-muted text-uppercase mb-2">Source Reference (SO No.)</label>
            <select className="form-select border-success" value={selectedOrderId} onChange={handleOrderSelection}>
              <option value="">-- Select Arrived SO --</option>
              {stockOrders.map(order => (
                <option key={order.id} value={order.id}>{order.order_number}</option>
              ))}
            </select>
          </div>

          {verificationList.length > 0 ? (
            <div>
              <div className="table-responsive border rounded bg-white">
                <table className="table align-middle mb-0">
                  <thead className="table-light small text-uppercase">
                    <tr>
                      <th style={{width: '25%'}}>Material Name</th>
                      <th>Classification</th>
                      <th>Category</th>
                      <th style={{width: '12%'}}>Arrived Qty</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verificationList.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          {/* 3. Situation: Materials Dropdown */}
                          <select className="form-select form-select-sm" value={item.material_name} onChange={(e) => handleInputChange(idx, 'material_name', e.target.value)}>
                            <option value="">-- Choose Material --</option>
                            {masterMaterials.map((m, i) => <option key={i} value={m.material_name}>{m.material_name}</option>)}
                          </select>
                        </td>
                        <td>
                          {/* 3. Situation: Classification Dropdown */}
                          <select className="form-select form-select-sm" value={item.classification} onChange={(e) => handleInputChange(idx, 'classification', e.target.value)}>
                            <option value="">-- Select --</option>
                            {uniqueClassifications.map((c, i) => <option key={i} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td>
                          {/* 3. Situation: Category Dropdown */}
                          <select className="form-select form-select-sm" value={item.category} onChange={(e) => handleInputChange(idx, 'category', e.target.value)}>
                            <option value="">-- Select --</option>
                            {uniqueCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
                          </select>
                        </td>
                        <td>
                          <input type="number" className="form-control form-control-sm text-center fw-bold" value={item.arrived_qty} onChange={(e) => handleInputChange(idx, 'arrived_qty', e.target.value)} />
                        </td>
                        <td className="text-center">
                          {/* 4. Situation: + and remove icons */}
                          <div className="btn-group">
                            <button className="btn btn-sm btn-outline-success border-0" onClick={addRow} title="Add Row">
                              <i className="bi bi-plus-circle-fill fs-5"></i>
                            </button>
                            {verificationList.length > 1 && (
                                <button className="btn btn-sm btn-outline-danger border-0" onClick={() => removeRow(idx)}>
                                    <i className="bi bi-dash-circle-fill fs-5"></i>
                                </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn btn-success w-100 fw-bold py-3 mt-4 shadow-sm" onClick={processInbound}>
                Save Final Entries to Inventory
              </button>
            </div>
          ) : (
            <div className="text-center py-5 border rounded bg-light border-dashed">
              <p className="text-muted fw-bold mb-0">Data is not yet available.</p>
              <small>Select a source SO No. above to start entering materials.</small>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Inbound;