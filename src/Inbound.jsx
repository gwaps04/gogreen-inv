import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Inbound() {
  const [stockOrders, setStockOrders] = useState([]);
  const [masterMaterials, setMasterMaterials] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedOrderNo, setSelectedOrderNo] = useState('');
  
  const [verificationList, setVerificationList] = useState([]); 
  const [savedItems, setSavedItems] = useState([]); 
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchArrivedOrders();
    fetchMaterialMaster();
  }, []);

  const fetchSavedItems = async (orderNo) => {
    if (!orderNo) return;
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .eq('reference_so', orderNo);
    setSavedItems(data || []);
  };

  const fetchArrivedOrders = async () => {
    const { data } = await supabase
      .from('stock_orders')
      .select('id, order_number')
      .eq('status', 'Stock Order Arrived');
    setStockOrders(data || []);
  };

  const fetchMaterialMaster = async () => {
    const { data } = await supabase.from('materials').select('material_name, classification, category, unit_of_measure');
    setMasterMaterials(data || []);
  };

  const handleOrderSelection = (e) => {
    const orderId = e.target.value;
    const orderObj = stockOrders.find(o => o.id === parseInt(orderId));
    
    setSelectedOrderId(orderId);
    const orderNo = orderObj ? orderObj.order_number : '';
    setSelectedOrderNo(orderNo);

    if (orderId) {
      setVerificationList([{ 
        material_name: '', classification: '', category: '', arrived_qty: 0, unit: '' 
      }]);
      fetchSavedItems(orderNo); 
    } else {
      setVerificationList([]);
      setSavedItems([]);
    }
  };

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

  const updateInventoryQty = async (id, newQty) => {
    const { error } = await supabase
      .from('inventory')
      .update({ qty: parseInt(newQty) })
      .eq('id', id);
    
    if (error) alert(error.message);
    else fetchSavedItems(selectedOrderNo);
  };

  const deleteInventoryItem = async (id) => {
    if (window.confirm("Remove this item from inventory records?")) {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) alert(error.message);
      else fetchSavedItems(selectedOrderNo);
    }
  };

  // MENTOR NOTE: Revised logic to handle empty staging rows during finalization
  const processInbound = async (isClosing) => {
    // 1. Filter out completely empty rows (where no material is selected)
    const itemsToProcess = verificationList.filter(item => item.material_name !== '');

    // 2. Validation: If they filled in a material but forgot the quantity
    if (itemsToProcess.some(item => parseInt(item.arrived_qty) <= 0)) {
        alert("Please ensure all staged rows have a valid Arrived Quantity.");
        return;
    }

    // 3. Validation: If trying to save record but staging area is empty
    if (!isClosing && itemsToProcess.length === 0) {
        alert("No new items staged. Please select a material to save.");
        return;
    }

    // 4. Confirmation Pop-up logic
    if (isClosing) {
        const confirmClose = window.confirm(
            "Are you sure to save and close this SO?\n\nNote: This will declared as Completed Stock Order."
        );
        if (!confirmClose) return;
    } else {
        if (!window.confirm(`Save these entries to Inventory under ${selectedOrderNo}?`)) return;
    }

    setLoading(true);

    try {
        // Only loop through valid items
        for (const item of itemsToProcess) {
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
                reference_so: selectedOrderNo,
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
              reference_so: selectedOrderNo,
              date_of_arrival: new Date().toISOString().split('T')[0]
            }]);
          }
        }

        if (isClosing) {
            await supabase.from('stock_orders').update({ status: 'Stock Order Closed Inbound' }).eq('id', selectedOrderId);
            alert(`Success: ${selectedOrderNo} is now CLOSED.`);
            setSelectedOrderId('');
            setVerificationList([]);
            setSavedItems([]);
        } else {
            alert(`Success: Items recorded. ${selectedOrderNo} remains OPEN.`);
            // Reset staging area to one empty row after saving
            setVerificationList([{ material_name: '', classification: '', category: '', arrived_qty: 0, unit: '' }]);
            fetchSavedItems(selectedOrderNo);
        }
        fetchArrivedOrders();
    } catch (err) {
        alert("An error occurred.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="row justify-content-center g-4">
      <div className="col-12">
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

          {selectedOrderId && (
            <>
              <h6 className="fw-bold mb-3 text-primary"><i className="bi bi-plus-square me-2"></i>Stage New Items</h6>
              <div className="table-responsive border rounded bg-white mb-4">
                <table className="table align-middle mb-0">
                  <thead className="table-light small text-uppercase">
                    <tr>
                      <th style={{width: '30%'}}>Material Name</th>
                      <th>Classification</th>
                      <th>Category</th>
                      <th style={{width: '15%'}}>Arrived Qty</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verificationList.map((item, idx) => (
                      <tr key={idx}>
                        <td>
                          <select className="form-select form-select-sm" value={item.material_name} onChange={(e) => handleInputChange(idx, 'material_name', e.target.value)}>
                            <option value="">-- Choose Material --</option>
                            {masterMaterials.map((m, i) => <option key={i} value={m.material_name}>{m.material_name}</option>)}
                          </select>
                        </td>
                        <td><select className="form-select form-select-sm bg-light" value={item.classification} disabled><option>{item.classification || '--'}</option></select></td>
                        <td><select className="form-select form-select-sm bg-light" value={item.category} disabled><option>{item.category || '--'}</option></select></td>
                        <td><input type="number" className="form-control form-control-sm text-center fw-bold" value={item.arrived_qty} onChange={(e) => handleInputChange(idx, 'arrived_qty', e.target.value)} /></td>
                        <td className="text-center">
                          <button className="btn btn-sm text-success border-0" onClick={addRow}><i className="bi bi-plus-circle-fill fs-5"></i></button>
                          {verificationList.length > 1 && <button className="btn btn-sm text-danger border-0" onClick={() => removeRow(idx)}><i className="bi bi-dash-circle-fill fs-5"></i></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {savedItems.length > 0 && (
                <div className="mt-2 mb-4">
                    <h6 className="fw-bold mb-3 text-secondary"><i className="bi bi-check-all me-2"></i>Items Already Saved to Inventory</h6>
                    <div className="table-responsive border rounded border-warning bg-light">
                        <table className="table align-middle mb-0 table-sm">
                            <thead className="bg-warning-subtle small text-uppercase">
                                <tr>
                                    <th className="ps-3">Material</th>
                                    <th>Classification</th>
                                    <th style={{width: '15%'}}>Qty</th>
                                    <th className="text-end pe-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {savedItems.map((item) => (
                                    <tr key={item.id}>
                                        <td className="ps-3 small fw-bold">{item.item_name}</td>
                                        <td className="small text-muted">{item.classification}</td>
                                        <td>
                                            <input type="number" className="form-control form-control-sm py-0 text-center" defaultValue={item.qty} onBlur={(e) => updateInventoryQty(item.id, e.target.value)} />
                                        </td>
                                        <td className="text-end pe-3">
                                            <button className="btn btn-sm text-danger" onClick={() => deleteInventoryItem(item.id)}><i className="bi bi-trash3"></i></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
              )}

              <div className="row g-3">
                <div className="col-12 col-md-6"><button className="btn btn-outline-success w-100 fw-bold py-3 shadow-sm" onClick={() => processInbound(false)} disabled={loading}>{loading ? 'Saving...' : 'Save Record (Keep SO Open)'}</button></div>
                <div className="col-12 col-md-6"><button className="btn btn-success w-100 fw-bold py-3 shadow-sm" onClick={() => processInbound(true)} disabled={loading}>{loading ? 'Finalizing...' : 'Save & Close Completed SO'}</button></div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Inbound;