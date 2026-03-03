import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

function MaterialMaster() {
  const [materials, setMaterials] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); 
  
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  // SITUATION 1: Initial state including all required fields
  const [formData, setFormData] = useState({
    material_name: '',
    classification: 'Solar Panel',
    category: 'Consumables',
    specs: '',
    unit_of_measure: 'Pieces (Pcs)',
    description: '',
    image_url: ''
  });

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    const { data, error } = await supabase.from('materials').select('*').order('material_name', { ascending: true });
    if (error) console.error("Error:", error.message);
    else setMaterials(data || []);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
        setImageFile(e.target.files[0]);
    }
  };

  // SITUATION 2: Modified handleSubmit with manual validation and confirmation
  const handleSubmit = async (e) => {
    e.preventDefault();

    // SITUATION 1: Manual Check for required fields
    if (!formData.material_name || !formData.classification || !formData.category || !formData.specs || !formData.unit_of_measure) {
      alert("Error: Material Name, Classification, Category, Technical Specs, and Unit of Measure are ALL required.");
      return;
    }

    // SITUATION 2: Popup Confirmation
    const isConfirmed = window.confirm(`Are you sure you want to add "${formData.material_name}" to the master list?`);
    if (!isConfirmed) return;

    setUploading(true);

    let finalImageUrl = '';

    if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${imageFile.name.replace(/\s/g, '_')}`;
        const filePath = `${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
                .from('material-images') 
                .upload(filePath, imageFile);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('material-images')
                .getPublicUrl(filePath);

            finalImageUrl = publicUrl;

        } catch (error) {
            alert('Upload failed: ' + error.message);
            setUploading(false);
            return;
        }
    }

    const finalData = { ...formData, image_url: finalImageUrl };
    const { error: dbError } = await supabase.from('materials').insert([finalData]);
    
    if (dbError) {
      alert("Database error: " + dbError.message);
    } else {
      setFormData({ 
        material_name: '', 
        classification: 'Solar Panel', 
        category: 'Consumables', 
        specs: '', 
        unit_of_measure: 'Pieces (Pcs)', 
        description: '', 
        image_url: '' 
      });
      setImageFile(null);
      e.target.reset();
      fetchMaterials();
      alert("Material Added Successfully!");
    }
    setUploading(false);
  };

  const handleDelete = async (id, imageUrl) => {
    if (window.confirm("Delete this material?")) {
        if (imageUrl) {
            const fileName = imageUrl.split('/').pop();
            await supabase.storage.from('material-images').remove([fileName]);
        }
        await supabase.from('materials').delete().eq('id', id);
        fetchMaterials();
    }
  };

  const filtered = materials.filter(m => 
    m.material_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.classification.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (m.category && m.category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="row g-4">
      {/* FORM SECTION */}
      <div className="col-md-4">
        <div className="card shadow-sm border-0 p-3">
          <h5 className="fw-bold mb-3 text-success">Register New Material</h5>
          <form onSubmit={handleSubmit}>
            {/* Required Field: Material Name */}
            <div className="mb-2">
              <label className="small fw-bold text-muted">Material Name *</label>
              <input type="text" name="material_name" className="form-control form-control-sm" placeholder="e.g. PV Wire" value={formData.material_name} onChange={handleChange} required />
            </div>
            
            {/* Required Field: Classification */}
            <div className="mb-2">
              <label className="small fw-bold text-muted">Classification *</label>
              <select name="classification" className="form-select form-select-sm" value={formData.classification} onChange={handleChange} required>
                <option value="Solar Panel">Solar Panel</option>
                <option value="Inverter">Inverter</option>
                <option value="Battery">Battery</option>
                <option value="Cables/Wires">Cables/Wires</option>
                <option value="Raceway Materials">Raceway Materials</option>
                  <option value="Mounting Kits">Mounting Kits</option>
                    <option value="Breaker">Breaker</option>
                      <option value="Protective">Protective</option>
              </select>
            </div>

            {/* Required Field: Category */}
            <div className="mb-2">
              <label className="small fw-bold text-muted text-uppercase">Category *</label>
              <select name="category" className="form-select form-select-sm border-success fw-bold" value={formData.category} onChange={handleChange} required>
                <option value="Consumables">Consumables</option>
                <option value="Outdoor">Outdoor</option>
                <option value="Indoor">Indoor</option>
                <option value="Protective Devices">Protective Devices</option>
              </select>
            </div>

            {/* Required Field: Technical Specs */}
            <div className="mb-2">
              <label className="small fw-bold text-muted">Technical Specs *</label>
              <input type="text" name="specs" className="form-control form-control-sm" placeholder="e.g. 4MM" value={formData.specs} onChange={handleChange} required />
            </div>

            {/* Required Field: Unit of Measure */}
            <div className="mb-2">
              <label className="small fw-bold text-muted">Unit of Measure *</label>
              <select name="unit_of_measure" className="form-select form-select-sm" value={formData.unit_of_measure} onChange={handleChange} required>
                <option value="Pieces (Pcs)">Pieces (Pcs)</option>
                <option value="Meters (m)">Meters (m)</option>
                <option value="Sets">Sets</option>
                <option value="Rolls">Rolls</option>
              </select>
            </div>

            <div className="mb-2">
              <label className="small fw-bold text-muted">Description</label>
              <textarea name="description" className="form-control form-control-sm" rows="2" placeholder="Brief details..." value={formData.description} onChange={handleChange}></textarea>
            </div>

            <div className="mb-3">
              <label className="small fw-bold text-muted">Material Image</label>
              <input type="file" className="form-control form-control-sm" accept="image/*" onChange={handleFileChange} />
            </div>

            <button className="btn btn-success w-100 fw-bold shadow-sm" disabled={uploading}>
                {uploading ? "Uploading..." : "Add to Master List"}
            </button>
          </form>
        </div>
      </div>

      {/* TABLE SECTION (Remains the same as before) */}
      <div className="col-md-8">
        <div className="card border-0 shadow-sm overflow-hidden">
          <div className="card-header bg-white py-3">
            <input type="text" className="form-control form-control-sm" placeholder="Search materials or categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="table-responsive">
            <table className="table align-middle table-hover mb-0">
              <thead className="table-light">
                <tr className="small text-muted text-uppercase">
                  <th>Item</th>
                  <th>Classification / Category</th>
                  <th>Specs/Unit</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id}>
                    <td>
                      <div className="d-flex align-items-center">
                        <div 
                          className="bg-light rounded me-2 d-flex align-items-center justify-content-center border shadow-sm" 
                          style={{width: '45px', height: '45px', overflow: 'hidden', cursor: 'pointer'}}
                          onClick={() => m.image_url && setSelectedImage(m)}
                        >
                          {m.image_url ? (
                            <img src={m.image_url} alt="item" style={{width: '100%', height: '100%', objectFit: 'cover'}} />
                          ) : (
                            <i className="bi bi-camera text-muted"></i>
                          )}
                        </div>
                        <div className="fw-bold small">{m.material_name}</div>
                      </div>
                    </td>
                    <td>
                      <div className="badge bg-info text-dark me-1" style={{fontSize: '0.7rem'}}>{m.classification}</div>
                      <div className="badge bg-secondary" style={{fontSize: '0.7rem'}}>{m.category || 'N/A'}</div>
                    </td>
                    <td>
                      <div className="small fw-bold">{m.specs}</div>
                      <div className="small text-muted" style={{fontSize: '0.75rem'}}>{m.unit_of_measure}</div>
                    </td>
                    <td className="text-center">
                      <button className="btn btn-sm text-danger border-0" onClick={() => handleDelete(m.id, m.image_url)}>
                        <i className="bi bi-trash-fill"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL FOR EXPANDED VIEW (Remains the same as before) */}
      {selectedImage && (
        <div className="modal show d-block" tabIndex="-1" style={{backgroundColor: 'rgba(0,0,0,0.8)'}} onClick={() => setSelectedImage(null)}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 bg-transparent text-center">
                <img src={selectedImage.image_url} className="img-fluid rounded shadow-lg" alt="Full view" style={{maxHeight: '80vh'}} />
                <div className="bg-white p-3 mt-2 rounded fw-bold text-success">
                    {selectedImage.material_name} - {selectedImage.specs}
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MaterialMaster;