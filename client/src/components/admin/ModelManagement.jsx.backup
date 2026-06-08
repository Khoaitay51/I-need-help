import React, { useState, useEffect } from 'react';
import { 
  FiPower, FiUpload, FiSettings, FiCheck, 
  FiX, FiSliders, FiAlertCircle, FiInfo, FiRefreshCw
} from 'react-icons/fi';
import './ModelManagement.css';

const ModelManagement = () => {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModel] = useState(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state for file upload
  const [uploadForm, setUploadForm] = useState({
    name: '',
    description: '',
    file: null,
    modelType: 'huggingface', // huggingface, ollama, gemini
    path: '',
    api_key: '',
    gemini_model: 'gemini-1.5-pro',
    ollama_model: 'llama3',
    ollama_url: 'http://localhost:11434',
    hf_token: ''
  });
  
  // Parameters for selected model
  const [modelParams, setModelParams] = useState({
    temperature: 0.7,
    top_p: 0.9,
    top_k: 40,
    max_tokens: 2048,
    presence_penalty: 0,
    frequency_penalty: 0,
    system_prompt: ''
  });
  
  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      try {
        // Gọi API để lấy danh sách models
        const response = await fetch('/api/models', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch models');
        }
        
        const result = await response.json();
        if (result.statusCode === 200 && result.data) {
          setModels(result.data);
          
          // Tìm model đang hoạt động
          const active = result.data.find(model => model.isActive);
          if (active) {
            setActiveModel(active.id);
          }
        } else {
          // Fallback to mock data nếu không có dữ liệu
          const mockModels = generateMockModels();
          setModels(mockModels);
          
          // Set active model
          const active = mockModels.find(m => m.isActive);
          if (active) {
            setActiveModel(active.id);
          }
        }
      } catch (error) {
        console.error('Error fetching models:', error);
        // Fallback to mock data
        const mockModels = generateMockModels();
        setModels(mockModels);
        
        // Set active model
        const active = mockModels.find(m => m.isActive);
        if (active) {
          setActiveModel(active.id);
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchModels();
  }, []);
  
  // Generate mock models data
  const generateMockModels = () => {
    return [
      {
        id: 'model-1',
        name: 'LLaMA 3 (70B)',
        description: 'LLaMA 3 (70B) - Mô hình ngôn ngữ lớn đa ngôn ngữ',
        size: '70B',
        uploadDate: new Date('2025-07-15'),
        lastUsed: new Date('2025-08-18'),
        isActive: true,
        stats: {
          averageResponseTime: 1.2,
          usageCount: 15420,
          tokensGenerated: 3245678
        },
        parameters: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          max_tokens: 2048,
          presence_penalty: 0,
          frequency_penalty: 0,
          system_prompt: 'Bạn là trợ lý AI của Học viện Kỹ thuật Mật mã. Hãy trả lời các câu hỏi một cách chính xác, ngắn gọn và hữu ích.'
        }
      },
      {
        id: 'model-2',
        name: 'LLaMA 3 (8B)',
        description: 'LLaMA 3 (8B) - Mô hình nhẹ cho triển khai nhanh',
        size: '8B',
        uploadDate: new Date('2025-07-01'),
        lastUsed: new Date('2025-08-15'),
        isActive: false,
        stats: {
          averageResponseTime: 0.8,
          usageCount: 8560,
          tokensGenerated: 1845123
        },
        parameters: {
          temperature: 0.8,
          top_p: 0.9,
          top_k: 50,
          max_tokens: 1024,
          presence_penalty: 0,
          frequency_penalty: 0,
          system_prompt: 'Bạn là trợ lý AI của Học viện Kỹ thuật Mật mã. Hãy trả lời các câu hỏi một cách ngắn gọn và hữu ích.'
        }
      },
      {
        id: 'model-3',
        name: 'Mistral 7B Vietnamese',
        description: 'Mistral 7B - Mô hình được tinh chỉnh cho tiếng Việt',
        size: '7B',
        uploadDate: new Date('2025-06-10'),
        lastUsed: new Date('2025-08-10'),
        isActive: false,
        stats: {
          averageResponseTime: 0.7,
          usageCount: 12340,
          tokensGenerated: 2154789
        },
        parameters: {
          temperature: 0.75,
          top_p: 0.85,
          top_k: 45,
          max_tokens: 1536,
          presence_penalty: 0.1,
          frequency_penalty: 0.1,
          system_prompt: 'Bạn là trợ lý AI của Học viện Kỹ thuật Mật mã. Hãy trả lời các câu hỏi bằng tiếng Việt một cách hữu ích.'
        }
      }
    ];
  };
  
  // Handle model activation
  const handleActivateModel = async (modelId) => {
    try {
      // Gọi API để kích hoạt model
      const response = await fetch(`/api/models/activate/${modelId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to activate model');
      }
      
      // Nếu API thành công, cập nhật state
      const result = await response.json();
      if (result.statusCode === 200) {
        // Cập nhật state local
        setModels(models.map(model => ({
          ...model,
          isActive: model.id === modelId
        })));
        
        setActiveModel(modelId);
      }
    } catch (error) {
      console.error('Error activating model:', error);
      // Fallback: Cập nhật UI dù có lỗi (để demo)
      setModels(models.map(model => ({
        ...model,
        isActive: model.id === modelId
      })));
      
      setActiveModel(modelId);
    }
  };
  
  // Open model parameters modal
  const handleOpenParamModal = (model) => {
    setSelectedModel(model);
    setModelParams(model.parameters);
    setParamModalOpen(true);
  };
  
  // Save model parameters
  const handleSaveParams = async () => {
    try {
      // Gọi API để cập nhật tham số model
      const response = await fetch(`/api/models/params/${selectedModel.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modelParams)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update model parameters');
      }
      
      // Nếu API thành công, cập nhật state
      const result = await response.json();
      if (result.statusCode === 200) {
        // Cập nhật state local
        setModels(models.map(model => {
          if (model.id === selectedModel.id) {
            return {
              ...model,
              parameters: modelParams
            };
          }
          return model;
        }));
        
        setParamModalOpen(false);
      }
    } catch (error) {
      console.error('Error saving model parameters:', error);
      // Fallback: Cập nhật UI dù có lỗi (để demo)
      setModels(models.map(model => {
        if (model.id === selectedModel.id) {
          return {
            ...model,
            parameters: modelParams
          };
        }
        return model;
      }));
      
      setParamModalOpen(false);
    }
  };
  
  // Handle file upload form changes
  const handleUploadFormChange = (e) => {
    const { name, value, files } = e.target;
    
    if (name === 'file' && files.length > 0) {
      setUploadForm(prev => ({
        ...prev,
        file: files[0]
      }));
    } else {
      setUploadForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  // Handle file upload
  const handleUploadModel = async (e) => {
    e.preventDefault();
    
    if (!uploadForm.name || !uploadForm.file) {
      alert('Vui lòng điền đầy đủ thông tin và chọn file');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        const newProgress = prev + (10 * Math.random());
        return newProgress >= 100 ? 100 : newProgress;
      });
    }, 500);
    
    try {
      // Trong thực tế, sẽ cần sử dụng FormData để upload file
      const formData = new FormData();
      formData.append('file', uploadForm.file);
      formData.append('name', uploadForm.name);
      formData.append('description', uploadForm.description || `Mô hình ${uploadForm.name}`);
      
      // Upload file trước (mô phỏng)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Sau khi upload file xong, tạo model mới trong DB
      const modelData = {
        name: uploadForm.name,
        description: uploadForm.description || `Mô hình ${uploadForm.name}`,
        modelType: uploadForm.modelType
      };
      
      // Thêm thông tin đặc thù cho từng loại model
      if (uploadForm.modelType === 'huggingface') {
        modelData.path = uploadForm.path;
        modelData.hf_token = uploadForm.hf_token;
      } else if (uploadForm.modelType === 'ollama') {
        modelData.ollama_model = uploadForm.ollama_model;
        modelData.ollama_url = uploadForm.ollama_url;
      } else if (uploadForm.modelType === 'gemini') {
        modelData.api_key = uploadForm.api_key;
        modelData.gemini_model = uploadForm.gemini_model;
      } else {
        modelData.path = uploadForm.path;
      }
      
      // Gọi API để tạo model mới
      const response = await fetch('/api/models/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(modelData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to create model');
      }
      
      const result = await response.json();
      
      if (result.statusCode === 201) {
        // Tạo model mới để thêm vào danh sách (vì API có thể không trả về đủ thông tin)
        const newModel = {
          id: result.data.id,
          name: uploadForm.name,
          description: uploadForm.description || `Mô hình ${uploadForm.name}`,
          size: 'N/A',
          uploadDate: new Date(),
          lastUsed: null,
          isActive: false,
          stats: {
            averageResponseTime: 0,
            usageCount: 0,
            tokensGenerated: 0
          },
          parameters: {
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            max_tokens: 2048,
            presence_penalty: 0,
            frequency_penalty: 0,
            system_prompt: ''
          }
        };
        
        setModels([...models, newModel]);
      }
      
      // Reset form
      setUploadForm({
        name: '',
        description: '',
        file: null,
        modelType: 'huggingface',
        path: '',
        api_key: '',
        gemini_model: 'gemini-1.5-pro',
        ollama_model: 'llama3',
        ollama_url: 'http://localhost:11434',
        hf_token: ''
      });
      
      setUploadModalOpen(false);
    } catch (error) {
      console.error('Error uploading model:', error);
      alert('Có lỗi xảy ra khi tải lên mô hình. Vui lòng thử lại sau.');
    } finally {
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };
  
  // Handle parameter changes
  const handleParamChange = (e) => {
    const { name, value, type } = e.target;
    
    setModelParams(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value
    }));
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return 'Chưa sử dụng';
    return new Date(date).toLocaleDateString('vi-VN');
  };
  
  if (loading) {
    return <div className="models-loading">Đang tải thông tin mô hình...</div>;
  }
  
  return (
    <div className="model-management">
      <div className="models-header">
        <div className="models-info">
          <FiInfo />
          <div>
            <h3>Quản lý mô hình ngôn ngữ</h3>
            <p>
              Trang này cho phép bạn quản lý các mô hình LLM, kích hoạt/vô hiệu hóa mô hình, 
              điều chỉnh tham số và tải lên mô hình mới.
            </p>
          </div>
        </div>
        
        <button 
          className="upload-model-button"
          onClick={() => setUploadModalOpen(true)}
        >
          <FiUpload />
          <span>Tải mô hình mới</span>
        </button>
      </div>
      
      <div className="active-model-section">
        <h3>Mô hình đang hoạt động</h3>
        
        {models.some(m => m.isActive) ? (
          models.filter(m => m.isActive).map(model => (
            <div key={model.id} className="active-model-card">
              <div className="active-model-info">
                <div className="active-model-name">
                  <h4>{model.name}</h4>
                  <span className="active-badge">Đang hoạt động</span>
                </div>
                <p className="active-model-description">{model.description}</p>
                
                <div className="active-model-stats">
                  <div className="active-model-stat">
                    <span className="stat-label">Thời gian phản hồi TB</span>
                    <span className="stat-value">{model.stats.averageResponseTime.toFixed(2)}s</span>
                  </div>
                  <div className="active-model-stat">
                    <span className="stat-label">Lượt sử dụng</span>
                    <span className="stat-value">{model.stats.usageCount.toLocaleString()}</span>
                  </div>
                  <div className="active-model-stat">
                    <span className="stat-label">Token đã tạo</span>
                    <span className="stat-value">{model.stats.tokensGenerated.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div className="active-model-actions">
                <button 
                  className="edit-params-button"
                  onClick={() => handleOpenParamModal(model)}
                >
                  <FiSettings />
                  <span>Điều chỉnh tham số</span>
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="no-active-model">
            <FiAlertCircle />
            <p>Không có mô hình nào đang hoạt động. Vui lòng kích hoạt một mô hình.</p>
          </div>
        )}
      </div>
      
      <div className="all-models-section">
        <h3>Tất cả mô hình</h3>
        
        <div className="models-list">
          {models.map(model => (
            <div 
              key={model.id} 
              className={`model-card ${model.isActive ? 'active' : ''}`}
            >
              <div className="model-header">
                <h4>{model.name}</h4>
                {model.isActive && <span className="model-active-badge">Đang hoạt động</span>}
              </div>
              
              <p className="model-description">{model.description}</p>
              
              <div className="model-details">
                <div className="model-detail">
                  <span className="detail-label">Kích thước</span>
                  <span className="detail-value">{model.size}</span>
                </div>
                <div className="model-detail">
                  <span className="detail-label">Ngày tải lên</span>
                  <span className="detail-value">{formatDate(model.uploadDate)}</span>
                </div>
                <div className="model-detail">
                  <span className="detail-label">Sử dụng gần nhất</span>
                  <span className="detail-value">{formatDate(model.lastUsed)}</span>
                </div>
              </div>
              
              <div className="model-actions">
                {!model.isActive && (
                  <button 
                    className="activate-button"
                    onClick={() => handleActivateModel(model.id)}
                  >
                    <FiPower />
                    <span>Kích hoạt</span>
                  </button>
                )}
                
                <button 
                  className="params-button"
                  onClick={() => handleOpenParamModal(model)}
                >
                  <FiSettings />
                  <span>Tham số</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Upload Model Modal */}
      {uploadModalOpen && (
        <div className="modal-overlay">
          <div className="upload-modal">
            <div className="modal-header">
              <h2>Tải lên mô hình mới</h2>
              <button 
                className="close-modal"
                onClick={() => setUploadModalOpen(false)}
                disabled={isUploading}
              >
                <FiX />
              </button>
            </div>
            
            <form onSubmit={handleUploadModel} className="upload-form">
              <div className="form-group">
                <label>Tên mô hình</label>
                <input
                  type="text"
                  name="name"
                  value={uploadForm.name}
                  onChange={handleUploadFormChange}
                  placeholder="Nhập tên mô hình"
                  disabled={isUploading}
                  required
                />
              </div>
              
              <div className="form-group">
                <label>Mô tả</label>
                <textarea
                  name="description"
                  value={uploadForm.description}
                  onChange={handleUploadFormChange}
                  placeholder="Nhập mô tả về mô hình"
                  disabled={isUploading}
                  rows={3}
                />
              </div>
              
              <div className="form-group">
                <label>Loại mô hình</label>
                <select 
                  name="modelType"
                  value={uploadForm.modelType}
                  onChange={handleUploadFormChange}
                  disabled={isUploading}
                >
                  <option value="huggingface">Hugging Face</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="gemini">Google Gemini</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              
              {uploadForm.modelType === 'huggingface' && (
                <>
                  <div className="form-group">
                    <label>Đường dẫn mô hình HF</label>
                    <input
                      type="text"
                      name="path"
                      value={uploadForm.path}
                      onChange={handleUploadFormChange}
                      placeholder="Ví dụ: NousResearch/Hermes-2-Pro-Llama-3-8B"
                      disabled={isUploading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>HF Token (nếu cần)</label>
                    <input
                      type="password"
                      name="hf_token"
                      value={uploadForm.hf_token}
                      onChange={handleUploadFormChange}
                      placeholder="Nhập Hugging Face API token"
                      disabled={isUploading}
                    />
                  </div>
                </>
              )}
              
              {uploadForm.modelType === 'ollama' && (
                <>
                  <div className="form-group">
                    <label>Tên mô hình Ollama</label>
                    <input
                      type="text"
                      name="ollama_model"
                      value={uploadForm.ollama_model}
                      onChange={handleUploadFormChange}
                      placeholder="Ví dụ: llama3, mistral, gemma"
                      disabled={isUploading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Ollama API URL</label>
                    <input
                      type="text"
                      name="ollama_url"
                      value={uploadForm.ollama_url}
                      onChange={handleUploadFormChange}
                      placeholder="http://localhost:11434"
                      disabled={isUploading}
                    />
                  </div>
                </>
              )}
              
              {uploadForm.modelType === 'gemini' && (
                <>
                  <div className="form-group">
                    <label>API Key Gemini</label>
                    <input
                      type="password"
                      name="api_key"
                      value={uploadForm.api_key}
                      onChange={handleUploadFormChange}
                      placeholder="Nhập Google API key"
                      disabled={isUploading}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Loại model Gemini</label>
                    <select
                      name="gemini_model"
                      value={uploadForm.gemini_model}
                      onChange={handleUploadFormChange}
                      disabled={isUploading}
                    >
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-2.0-pro">Gemini 2.0 Pro</option>
                    </select>
                  </div>
                </>
              )}
              
              {uploadForm.modelType === 'other' && (
                <div className="form-group">
                  <label>Đường dẫn mô hình</label>
                  <input
                    type="text"
                    name="path"
                    value={uploadForm.path}
                    onChange={handleUploadFormChange}
                    placeholder="Nhập đường dẫn hoặc định danh của mô hình"
                    disabled={isUploading}
                  />
                </div>
              )}

              {uploadForm.modelType === 'huggingface' && (
                <div className="form-group">
                  <label>File mô hình (tùy chọn)</label>
                  <div className="file-input-container">
                    <input
                      type="file"
                      name="file"
                      onChange={handleUploadFormChange}
                      disabled={isUploading}
                      id="model-file"
                      className="file-input"
                    />
                    <label htmlFor="model-file" className="file-input-label">
                      <FiUpload />
                      <span>{uploadForm.file ? uploadForm.file.name : 'Chọn file mô hình'}</span>
                    </label>
                  </div>
                  <small className="file-hint">
                    Hỗ trợ các định dạng .bin, .gguf, .safetensors
                  </small>
                </div>
              )}
              
              {isUploading && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-bar-fill" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{Math.round(uploadProgress)}%</span>
                </div>
              )}
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={isUploading}
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit" 
                  className="upload-button"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <FiRefreshCw className="spinning" />
                      <span>Đang tải lên...</span>
                    </>
                  ) : (
                    <>
                      <FiUpload />
                      <span>Tải lên</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* Parameters Modal */}
      {paramModalOpen && selectedModel && (
        <div className="modal-overlay">
          <div className="params-modal">
            <div className="modal-header">
              <h2>Điều chỉnh tham số - {selectedModel.name}</h2>
              <button 
                className="close-modal"
                onClick={() => setParamModalOpen(false)}
              >
                <FiX />
              </button>
            </div>
            
            <div className="params-form">
              <div className="params-section">
                <h3>Tham số suy luận</h3>
                
                <div className="params-grid">
                  <div className="param-group">
                    <label htmlFor="temperature">
                      Temperature
                      <span className="param-value">{modelParams.temperature}</span>
                    </label>
                    <input
                      type="range"
                      id="temperature"
                      name="temperature"
                      min="0"
                      max="2"
                      step="0.05"
                      value={modelParams.temperature}
                      onChange={handleParamChange}
                    />
                    <div className="param-hint">
                      Giá trị thấp hơn mang lại kết quả nhất quán hơn, giá trị cao hơn mang lại kết quả đa dạng hơn.
                    </div>
                  </div>
                  
                  <div className="param-group">
                    <label htmlFor="top_p">
                      Top P
                      <span className="param-value">{modelParams.top_p}</span>
                    </label>
                    <input
                      type="range"
                      id="top_p"
                      name="top_p"
                      min="0"
                      max="1"
                      step="0.05"
                      value={modelParams.top_p}
                      onChange={handleParamChange}
                    />
                    <div className="param-hint">
                      Lấy mẫu từ tập các token có xác suất tích lũy là top_p. Thay thế cho top_k nếu &lt; 1.0.
                    </div>
                  </div>
                  
                  <div className="param-group">
                    <label htmlFor="top_k">
                      Top K
                      <span className="param-value">{modelParams.top_k}</span>
                    </label>
                    <input
                      type="range"
                      id="top_k"
                      name="top_k"
                      min="0"
                      max="100"
                      step="1"
                      value={modelParams.top_k}
                      onChange={handleParamChange}
                    />
                    <div className="param-hint">
                      Lấy mẫu từ top_k token có xác suất cao nhất tại mỗi bước.
                    </div>
                  </div>
                  
                  <div className="param-group">
                    <label htmlFor="max_tokens">
                      Max Tokens
                      <span className="param-value">{modelParams.max_tokens}</span>
                    </label>
                    <input
                      type="range"
                      id="max_tokens"
                      name="max_tokens"
                      min="256"
                      max="4096"
                      step="32"
                      value={modelParams.max_tokens}
                      onChange={handleParamChange}
                    />
                    <div className="param-hint">
                      Số lượng token tối đa mà mô hình sẽ tạo ra trong một phản hồi.
                    </div>
                  </div>
                  
                  <div className="param-group">
                    <label htmlFor="presence_penalty">
                      Presence Penalty
                      <span className="param-value">{modelParams.presence_penalty}</span>
                    </label>
                    <input
                      type="range"
                      id="presence_penalty"
                      name="presence_penalty"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={modelParams.presence_penalty}
                      onChange={handleParamChange}
                    />
                    <div className="param-hint">
                      Giá trị dương khuyến khích mô hình sử dụng các token mới.
                    </div>
                  </div>
                  
                  <div className="param-group">
                    <label htmlFor="frequency_penalty">
                      Frequency Penalty
                      <span className="param-value">{modelParams.frequency_penalty}</span>
                    </label>
                    <input
                      type="range"
                      id="frequency_penalty"
                      name="frequency_penalty"
                      min="-2"
                      max="2"
                      step="0.1"
                      value={modelParams.frequency_penalty}
                      onChange={handleParamChange}
                    />
                    <div className="param-hint">
                      Giá trị dương làm giảm xác suất lặp lại cùng một token.
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="system-prompt-section">
                <h3>System Prompt</h3>
                <textarea
                  name="system_prompt"
                  value={modelParams.system_prompt}
                  onChange={handleParamChange}
                  placeholder="Nhập system prompt để định hướng mô hình"
                  rows={5}
                />
                <div className="param-hint">
                  System prompt giúp định hướng hành vi của mô hình và thiết lập bối cảnh ban đầu.
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setParamModalOpen(false)}
                >
                  Hủy bỏ
                </button>
                <button 
                  type="button" 
                  className="save-button"
                  onClick={handleSaveParams}
                >
                  <FiCheck />
                  <span>Lưu tham số</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelManagement;
