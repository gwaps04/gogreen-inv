import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({ supplier_name: '', contact_person: '', phone_number: '' });

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    const { data } = await supabase.from('suppliers').select('*');
    setSuppliers(data || []);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('suppliers').insert([formData]);
    setFormData({ supplier_name: '', contact_person: '', phone_number: '' });
    fetchSuppliers();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this supplier?")) {
      await supabase.from('suppliers').delete().eq('id', id);
      fetchSuppliers();
    }
  };

  const filtered = suppliers.filter(s => s.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="row g-4">
      <div className="col-md-4">
        <div className="card shadow-sm border-0 p-3">
          <h5 className="fw-bold">Add Supplier</h5>
          <form onSubmit={handleSubmit}>
            <input type="text" className="form-control mb-2" placeholder="Company Name" value={formData.supplier_name} onChange={(e) => setFormData({...formData, supplier_name: e.target.value})} required />
            <input type="text" className="form-control mb-3" placeholder="Contact" value={formData.contact_person} onChange={(e) => setFormData({...formData, contact_person: e.target.value})} />
            <button className="btn btn-primary w-100">Save</button>
          </form>
        </div>
      </div>
      <div className="col-md-8">
        <input type="text" className="form-control mb-3" placeholder="Search Suppliers..." onChange={(e) => setSearchTerm(e.target.value)} />
        <div className="table-responsive bg-white rounded shadow-sm">
          <table className="table align-middle">
            <thead><tr><th>Name</th><th>Contact</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.id}>
                  <td>{s.supplier_name}</td>
                  <td>{s.contact_person}</td>
                  <td><button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(s.id)}><i className="bi bi-trash"></i></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Suppliers;