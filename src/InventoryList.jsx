import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function InventoryList() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('item_name', { ascending: true });

    if (error) {
      console.error('Error fetching inventory:', error);
    } else {
      // LOGIC: Group by item_name + category to prevent duplication in UI
      const groupedData = data.reduce((acc, current) => {
        const key = `${current.item_name}-${current.category}`;
        if (!acc[key]) {
          acc[key] = { ...current };
        } else {
          acc[key].qty += current.qty; // Sum up quantities
        }
        return acc;
      }, {});

      setInventory(Object.values(groupedData));
    }
    setLoading(false);
  };

  // Status helper to determine color and text
  const getStockStatus = (qty) => {
    if (qty <= 0) return { label: 'Out of Stock', class: 'bg-danger-subtle text-danger border-danger' };
    if (qty <= 5) return { label: 'Low Stock', class: 'bg-warning-subtle text-warning border-warning' };
    return { label: 'In Stock', class: 'bg-success-subtle text-success border-success' };
  };

  const filteredInventory = inventory.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container-fluid py-4">
      <div className="card shadow-sm border-0 rounded-3">
        <div className="card-header bg-white py-3 border-bottom-0">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
            <h4 className="fw-bold text-dark mb-0">Warehouse Inventory Master List</h4>
            <div className="d-flex gap-2">
              <input 
                type="text" 
                className="form-control form-control-sm shadow-none border-secondary-subtle" 
                placeholder="Search materials..." 
                style={{ width: '250px' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="btn btn-sm btn-outline-success" onClick={fetchInventory}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table align-middle table-hover mb-0">
              <thead className="table-light">
                <tr className="small text-uppercase fw-bold text-muted">
                  <th className="ps-4">Material Name</th>
                  <th>Category</th>
                  <th>Classification</th>
                  <th className="text-center">Current Qty</th>
                  <th>Unit</th>
                  <th className="text-center">Status</th>
                  <th className="pe-4 text-end">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-5 text-muted">Loading warehouse data...</td></tr>
                ) : filteredInventory.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-5 text-muted">No materials found.</td></tr>
                ) : (
                  filteredInventory.map((item) => {
                    const status = getStockStatus(item.qty);
                    return (
                      <tr key={item.id}>
                        <td className="ps-4 fw-bold text-dark">{item.item_name}</td>
                        <td><span className="badge bg-light text-dark border">{item.category}</span></td>
                        <td className="text-muted small">{item.classification || 'N/A'}</td>
                        <td className="text-center">
                          <span className={`fw-bold fs-6 ${item.qty <= 5 ? 'text-danger' : 'text-primary'}`}>
                            {item.qty}
                          </span>
                        </td>
                        <td className="small text-secondary">{item.item_type || 'pcs'}</td>
                        <td className="text-center">
                          <span className={`badge border px-3 py-2 rounded-pill ${status.class}`} style={{ fontSize: '0.75rem' }}>
                            {status.label}
                          </span>
                        </td>
                        <td className="pe-4 text-end text-muted small">
                          {item.date_of_arrival || 'N/A'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InventoryList;