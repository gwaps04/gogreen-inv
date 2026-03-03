import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 1. Updated Initial State to include new fields
  const [formData, setFormData] = useState({ 
    supplier_name: '', 
    contact_person: '', 
    phone_number: '',
    email: '',
    alt_phone: '',
    website: '',
    shop_link: ''
  });

  useEffect(() => { 
    fetchSuppliers(); 
  }, []);

  const fetchSuppliers = async () => {
    const { data, error } = await supabase.from('suppliers').select('*');
    if (error) {
      console.error("Error fetching suppliers:", error.message);
    } else {
      setSuppliers(data || []);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // 2. The insert will now include all fields from formData
    const { error } = await supabase.from('suppliers').insert([formData]);
    
    if (error) {
      alert("Error saving supplier: " + error.message);
    } else {
      // Reset form on success
      setFormData({ 
        supplier_name: '', 
        contact_person: '', 
        phone_number: '',
        email: '',
        alt_phone: '',
        website: '',
        shop_link: ''
      });
      fetchSuppliers();
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this supplier?")) {
      await supabase.from('suppliers').delete().eq('id', id);
      fetchSuppliers();
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const filtered = suppliers.filter(s => 
    s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="row g-4">
      {/* ADD SUPPLIER FORM */}
      <div className="col-md-4">
        <div className="card shadow-sm border-0 p-3">
          <h5 className="fw-bold mb-3">Add New Supplier</h5>
          <form onSubmit={handleSubmit}>
            <div className="mb-2">
              <label className="small fw-bold">Company Name *</label>
              <input type="text" name="supplier_name" className="form-control" placeholder="e.g. Solar Panels Inc" value={formData.supplier_name} onChange={handleChange} required />
            </div>
            
            <div className="mb-2">
              <label className="small fw-bold">Contact Person</label>
              <input type="text" name="contact_person" className="form-control" placeholder="Name" value={formData.contact_person} onChange={handleChange} />
            </div>

            <div className="row g-2 mb-2">
              <div className="col-6">
                <label className="small fw-bold">Primary Phone</label>
                <input type="text" name="phone_number" className="form-control" placeholder="Phone" value={formData.phone_number} onChange={handleChange} />
              </div>
              <div className="col-6">
                <label className="small fw-bold">Alt Phone</label>
                <input type="text" name="alt_phone" className="form-control" placeholder="Optional" value={formData.alt_phone} onChange={handleChange} />
              </div>
            </div>

            <div className="mb-2">
              <label className="small fw-bold">Email Address</label>
              <input type="email" name="email" className="form-control" placeholder="email@example.com" value={formData.email} onChange={handleChange} />
            </div>

            <div className="mb-2">
              <label className="small fw-bold">Website URL</label>
              <input type="url" name="website" className="form-control" placeholder="https://..." value={formData.website} onChange={handleChange} />
            </div>

            <div className="mb-3">
              <label className="small fw-bold">Online Shop Link</label>
              <input type="url" name="shop_link" className="form-control" placeholder="Lazada/Shopee Link" value={formData.shop_link} onChange={handleChange} />
            </div>

            <button className="btn btn-success w-100 fw-bold">Save Supplier</button>
          </form>
        </div>
      </div>

      {/* SUPPLIERS LIST */}
      <div className="col-md-8">
        <div className="d-flex mb-3">
            <div className="input-group">
                <span className="input-group-text bg-white border-end-0"><i className="bi bi-search"></i></span>
                <input type="text" className="form-control border-start-0" placeholder="Search Suppliers..." onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>

        <div className="table-responsive bg-white rounded shadow-sm">
          <table className="table align-middle table-hover mb-0">
            <thead className="table-light">
              <tr>
                <th>Supplier Details</th>
                <th>Contact Info</th>
                <th>Links</th>
                <th className="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>
                    <div className="fw-bold text-success">{s.supplier_name}</div>
                    <div className="small text-muted">{s.contact_person || 'No contact person'}</div>
                  </td>
                  <td>
                    <div className="small"><i className="bi bi-telephone me-1"></i> {s.phone_number || 'N/A'}</div>
                    {s.email && <div className="small text-muted"><i className="bi bi-envelope me-1"></i> {s.email}</div>}
                  </td>
                  <td>
                    {s.website && <a href={s.website} target="_blank" rel="noreferrer" className="btn btn-sm btn-link p-0 me-2"><i className="bi bi-globe"></i></a>}
                    {s.shop_link && <a href={s.shop_link} target="_blank" rel="noreferrer" className="btn btn-sm btn-link p-0 text-orange"><i className="bi bi-cart-fill"></i></a>}
                  </td>
                  <td className="text-center">
                    <button className="btn btn-sm btn-outline-danger border-0" onClick={() => handleDelete(s.id)}>
                      <i className="bi bi-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="4" className="text-center py-4 text-muted">No suppliers found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Suppliers;