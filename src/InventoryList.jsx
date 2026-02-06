import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function InventoryList() {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // State for Editing
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('category', { ascending: true });

    if (error) console.error('Error fetching inventory:', error);
    else setInventory(data);
    setLoading(false);
  };

  // --- DELETE FUNCTION ---
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item? This cannot be undone.")) {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) alert("Error: " + error.message);
      else fetchInventory(); // Refresh list
    }
  };

  // --- EDIT FUNCTIONS ---
  const startEdit = (item) => setEditingItem({ ...item });
  
  const handleUpdate = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('inventory')
      .update({
        item_name: editingItem.item_name,
        category: editingItem.category,
        item_type: editingItem.item_type,
        size_dimension: editingItem.size_dimension,
        qty: editingItem.qty
      })
      .eq('id', editingItem.id);

    if (error) alert("Update failed: " + error.message);
    else {
      setEditingItem(null);
      fetchInventory();
    }
  };

  const filteredInventory = inventory.filter((item) =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="text-center mt-5"><div className="spinner-border text-success"></div></div>;

  return (
    <div className="card shadow-sm border-0">
      {/* Search Header */}
      <div className="card-header bg-white py-3">
        <div className="row align-items-center g-3">
          <div className="col-md-6"><h5 className="mb-0 fw-bold">Current Stock Levels</h5></div>
          <div className="col-md-6">
            <input type="text" className="form-control" placeholder="Search materials..." 
              value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-light">
            <tr>
              <th>Item Details</th>
              <th>Category</th>
              <th className="text-center">Qty</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item) => (
              <tr key={item.id}>
                {editingItem && editingItem.id === item.id ? (
                  /* EDIT MODE ROW */
                  <td colSpan="4">
                    <form onSubmit={handleUpdate} className="row g-2 p-2">
                      <div className="col-md-3">
                        <input type="text" className="form-control form-control-sm" value={editingItem.item_name} 
                          onChange={(e) => setEditingItem({...editingItem, item_name: e.target.value})} />
                      </div>
                      <div className="col-md-2">
                        <select className="form-select form-select-sm" value={editingItem.category}
                          onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}>
                          <option value="Outdoor">Outdoor</option>
                          <option value="Indoor">Indoor</option>
                          <option value="Metal_Enclosure">Metal Enclosure</option>
                          <option value="Consumables">Consumables</option>
                        </select>
                      </div>
                      <div className="col-md-2">
                        <input type="number" className="form-control form-control-sm" value={editingItem.qty}
                          onChange={(e) => setEditingItem({...editingItem, qty: e.target.value})} />
                      </div>
                      <div className="col-md-5 text-end">
                        <button type="submit" className="btn btn-sm btn-success me-2">Save</button>
                        <button type="button" className="btn btn-sm btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
                      </div>
                    </form>
                  </td>
                ) : (
                  /* VIEW MODE ROW */
                  <>
                    <td>
                      <div className="fw-bold">{item.item_name}</div>
                      <small className="text-muted">{item.item_type} | {item.size_dimension}</small>
                    </td>
                    <td><span className="badge bg-light text-dark border">{item.category}</span></td>
                    <td className="text-center"><span className="badge bg-success">{item.qty}</span></td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-primary me-2" onClick={() => startEdit(item)}>
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(item.id)}>
                        <i className="bi bi-trash"></i>
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default InventoryList;