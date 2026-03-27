import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable'; 

function JobOrders() {
  const [jobOrders, setJobOrders] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);
  const [newStatus, setNewStatus] = useState('');
  const [remarks, setRemarks] = useState('');

  const [formData, setFormData] = useState({
    full_address: '', 
    person_in_charge: '', 
    jo_type: 'Installation',
    scheduled_date: new Date().toISOString().split('T')[0]
  });
  
  const [itemEdits, setItemEdits] = useState([]);

  useEffect(() => { fetchJobs(); }, []);

  // MENTOR NOTE: Changed to a more robust "Manual Join" to bypass Supabase Join issues
  const fetchJobs = async () => {
    // 1. Fetch Job Orders and Movements
    const { data: jobs, error: jobsErr } = await supabase
      .from('job_orders')
      .select(`
        *,
        stock_movements (
          id,
          quantity,
          inventory_id,
          inventory ( item_name, qty, category )
        )
      `)
      .order('created_at', { ascending: false });

    // 2. Fetch all Statuses separately
    const { data: statuses, error: statErr } = await supabase
      .from('job_statuses')
      .select('*');

    if (jobsErr || statErr) {
        console.error("Fetch Error:", jobsErr || statErr);
    } else {
        // 3. Manually combine them so we are 100% sure the data links up
        const combinedData = jobs.map(job => ({
            ...job,
            // Find the status record that matches this job's ID
            current_status_record: statuses.find(s => s.job_order_id === job.id)
        }));
        
        console.log("COMBINED SYNCED DATA:", combinedData);
        setJobOrders(combinedData);
    }
  };

  const downloadJobsReport = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); 
    doc.setFontSize(18);
    doc.text("GO GREEN SOLAR - JOB ORDER MASTER LIST", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

    const tableData = jobOrders.map(job => {
      const materials = job.stock_movements.map(m => `${m.inventory?.item_name} (x${m.quantity})`).join('\n');
      
      // Using our new merged status record
      const statusObj = job.current_status_record;
      const currentStatus = statusObj ? statusObj.status : 'Open - Installation in Progress';
      
      const lastUpdate = statusObj?.updated_at 
        ? new Date(statusObj.updated_at).toLocaleDateString() + ' ' + new Date(statusObj.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        : 'N/A';

      return [
        job.jo_number,
        job.person_in_charge,
        job.jo_type,
        materials || 'No materials issued',
        currentStatus,
        lastUpdate
      ];
    });

    autoTable(doc, {
      startY: 35,
      head: [['JO #', 'Person in Charge', 'Type', 'Supplies Details', 'Status', 'Last Status Update']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [25, 135, 84] },
      styles: { fontSize: 8, cellPadding: 3 },
      columnStyles: { 4: { fontStyle: 'bold' } }
    });

    doc.save(`Job_Report_Synced_${Date.now()}.pdf`);
  };

  const handleStatusUpdate = async (e) => {
    e.preventDefault();
    
    const { error } = await supabase
      .from('job_statuses')
      .upsert({ 
        job_order_id: statusTarget.id, 
        status: newStatus, 
        remarks: remarks,
        updated_at: new Date().toISOString()
      }, { onConflict: 'job_order_id' });

    if (error) {
      alert("Error saving: " + error.message);
    } else {
      setShowStatusModal(false);
      await fetchJobs(); // Force UI to refresh immediately
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      const { error: joError } = await supabase.from('job_orders').update(formData).eq('id', editingId);
      if (joError) return alert(joError.message);
      fetchJobs();
    } else {
      const { data: newJO, error } = await supabase.from('job_orders').insert([formData]).select();
      if (!error) {
          await supabase.from('job_statuses').insert([{ 
              job_order_id: newJO[0].id, 
              status: 'Open - Installation in Progress' 
          }]);
          alert("Job Order Created!");
          fetchJobs();
      }
    }
    setEditingId(null);
    setFormData({ full_address: '', person_in_charge: '', jo_type: 'Installation', scheduled_date: new Date().toISOString().split('T')[0] });
  };

  const handleEdit = (job) => {
    setEditingId(job.id);
    setFormData({ 
      full_address: job.full_address, 
      person_in_charge: job.person_in_charge, 
      jo_type: job.jo_type || 'Installation',
      scheduled_date: job.scheduled_date 
    });
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete JO?")) {
      await supabase.from('job_orders').delete().eq('id', id);
      fetchJobs();
    }
  };

  const getStatusBadge = (status) => {
    if (!status) return 'bg-secondary'; 
    if (status.includes('Closed')) return 'bg-success';
    if (status.includes('Troubleshooting')) return 'bg-warning text-dark';
    return 'bg-info text-dark';
  };

  const filteredJobs = jobOrders.filter(j => 
    j.person_in_charge.toLowerCase().includes(searchTerm.toLowerCase()) || 
    j.jo_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="row g-4">
      {/* FORM SECTION */}
      <div className="col-12 col-lg-4">
        <div className="card shadow-sm border-0 p-3 p-md-4 sticky-top" style={{ top: '80px' }}>
          <h5 className="fw-bold text-success">
            {editingId ? 'Edit Job Order' : 'New Job Order'}
          </h5>
          <hr />
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="small fw-bold text-muted text-uppercase">Job Type</label>
              <div className="btn-group w-100">
                <input type="radio" className="btn-check" id="t1" checked={formData.jo_type === 'Installation'} onChange={() => setFormData({...formData, jo_type: 'Installation'})} />
                <label className="btn btn-outline-success btn-sm" htmlFor="t1">Installation</label>
                <input type="radio" className="btn-check" id="t2" checked={formData.jo_type === 'Repair'} onChange={() => setFormData({...formData, jo_type: 'Repair'})} />
                <label className="btn btn-outline-warning btn-sm" htmlFor="t2">Repair</label>
              </div>
            </div>
            <div className="mb-2">
              <label className="small fw-bold text-muted">Site Address</label>
              <textarea className="form-control" rows="2" value={formData.full_address} onChange={(e) => setFormData({...formData, full_address: e.target.value})} required />
            </div>
            <div className="mb-2">
              <label className="small fw-bold text-muted">Person in Charge</label>
              <input type="text" className="form-control" value={formData.person_in_charge} onChange={(e) => setFormData({...formData, person_in_charge: e.target.value})} required />
            </div>
            <div className="mb-4">
              <label className="small fw-bold text-muted">Scheduled Date</label>
              <input type="date" className="form-control" value={formData.scheduled_date} onChange={(e) => setFormData({...formData, scheduled_date: e.target.value})} required />
            </div>
            <button className="btn btn-success w-100 fw-bold">{editingId ? 'Save Changes' : 'Generate Job Order'}</button>
          </form>
        </div>
      </div>

      {/* LIST SECTION */}
      <div className="col-12 col-lg-8">
        <div className="row g-2 mb-3">
            <div className="col-md-8"><input type="text" className="form-control" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
            <div className="col-md-4"><button className="btn btn-outline-success w-100 fw-bold" onClick={downloadJobsReport}><i className="bi bi-file-earmark-pdf-fill me-2"></i>Export PDF</button></div>
        </div>
        
        <div className="table-responsive bg-white rounded shadow-sm border overflow-hidden">
          <table className="table align-middle mb-0">
            <thead className="table-light"><tr><th className="ps-4">JO Details</th><th>Site/Contact</th><th style={{width: '200px'}}>Current Status</th><th className="text-end pe-4">Actions</th></tr></thead>
            <tbody>
                {filteredJobs.map(job => {
                  // SITUATION: Using our client-side merged status record
                  const statusObj = job.current_status_record;
                  return (
                  <tr key={job.id}>
                    <td className="ps-4 py-3">
                      <div className="fw-bold text-success fs-5">{job.jo_number} <span className="badge bg-light text-primary border small" style={{fontSize: '0.6rem'}}>{job.jo_type}</span></div>
                      <div className="bg-light p-2 rounded mt-2 border-start border-3 border-success">
                        {job.stock_movements.map((m, i) => (
                          <div key={i} className="small d-flex justify-content-between">
                            <span>{m.inventory?.item_name}</span><span className="fw-bold">x{m.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="fw-bold">{job.person_in_charge}</div>
                      <div className="small text-muted text-truncate" style={{maxWidth: '150px'}} title={job.full_address}>{job.full_address}</div>
                    </td>
                    <td>
                      <button className="btn btn-sm btn-dark w-100 fw-bold mb-2" onClick={() => {
                          setStatusTarget(job);
                          setNewStatus(statusObj?.status || 'Open - Installation in Progress');
                          setRemarks(statusObj?.remarks || '');
                          setShowStatusModal(true);
                      }}>Update Status</button>
                      
                      {/* SITUATION: Real-time status display */}
                      <div className={`badge w-100 p-2 text-white shadow-sm ${getStatusBadge(statusObj?.status)}`} style={{fontSize: '0.75rem', whiteSpace: 'normal'}}>
                        {statusObj ? statusObj.status : 'Open - Installation in Progress'}
                      </div>
                      
                      {statusObj?.updated_at && (
                        <div className="text-center mt-1">
                            <small className="text-muted fw-bold" style={{fontSize: '0.6rem'}}>
                                Updated: {new Date(statusObj.updated_at).toLocaleDateString()}
                            </small>
                        </div>
                      )}
                    </td>
                    <td className="text-end pe-4">
                      <div className="btn-group"><button className="btn btn-sm text-primary" onClick={() => handleEdit(job)}><i className="bi bi-pencil"></i></button><button className="btn btn-sm text-danger" onClick={() => handleDelete(job.id)}><i className="bi bi-trash"></i></button></div>
                    </td>
                  </tr>
                )})}
            </tbody>
          </table>
        </div>
      </div>

      {/* STATUS MODAL */}
      {showStatusModal && (
        <div className="modal show d-block" style={{backgroundColor: 'rgba(0,0,0,0.7)'}}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-header bg-dark text-white"><h6 className="modal-title fw-bold">Update Job Status</h6><button type="button" className="btn-close btn-close-white" onClick={() => setShowStatusModal(false)}></button></div>
              <form onSubmit={handleStatusUpdate}>
                <div className="modal-body p-4">
                    <label className="small fw-bold text-muted text-uppercase mb-2 d-block">Select Status</label>
                    <select className="form-select mb-3" value={newStatus} onChange={(e) => setNewStatus(e.target.value)} required>
                        <option value="Open - Installation in Progress">Open - Installation in Progress</option>
                        <option value="Closed - Installed">Closed - Installed</option>
                        <option value="Open - Troubleshooting">Open - Troubleshooting</option>
                        <option value="Closed - Fix/Repaired">Closed - Fix/Repaired</option>
                    </select>
                    <label className="small fw-bold text-muted text-uppercase mb-2 d-block">Remarks</label>
                    <textarea className="form-control" rows="3" value={remarks} onChange={(e) => setRemarks(e.target.value)}></textarea>
                </div>
                <div className="modal-footer"><button type="submit" className="btn btn-dark fw-bold px-4">Save Status</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JobOrders;