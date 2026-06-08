import React, { useState, useEffect } from "react";
import {
  FiPower,
  FiCheck,
  FiX,
  FiAlertCircle,
  FiInfo,
  FiRefreshCw,
  FiPlayCircle,
} from "react-icons/fi";
import "./ModelManagement.css";
import modelService from "../../services/modelService";

const ModelManagement = () => {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState([]);
  const [currentModel, setCurrentModel] = useState(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testPrompt, setTestPrompt] = useState("Xin chào, bạn là ai?");
  const [isTesting, setIsTesting] = useState(false);
  const [selectedModelForTest, setSelectedModelForTest] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Custom Model config
  const [customModelType, setCustomModelType] = useState("gemini");
  const [customModelName, setCustomModelName] = useState("");

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const [availableModelsResponse, currentModelResponse] = await Promise.all(
        [modelService.getAvailableModels(), modelService.getCurrentModel()],
      );

      console.log("Available models response:", availableModelsResponse);
      console.log("Current model response:", currentModelResponse);

      if (availableModelsResponse) {
        // Response trả trực tiếp object, không có wrapper 'data'
        const data = availableModelsResponse.data || availableModelsResponse;
        let modelsList = [];

        console.log("Data to process:", data);

        // Xử lý cấu trúc dữ liệu từ backend
        // Backend trả về ollama_models và gemini_models
        if (data.ollama_models && Array.isArray(data.ollama_models)) {
          const ollamaModels = data.ollama_models.map((model) => ({
            name: model.name,
            model_name: model.name,
            provider: "ollama",
            description: `${model.details?.family || "Ollama"} - ${
              model.details?.parameter_size || "Unknown size"
            }`,
            max_tokens: 4096, // default
            supports_streaming: true,
            details: model.details,
          }));
          modelsList = [...modelsList, ...ollamaModels];
        }

        if (data.gemini_models && Array.isArray(data.gemini_models)) {
          const geminiModels = data.gemini_models.map((model) => ({
            name: model.name,
            model_name: model.name,
            provider: "gemini",
            description: model.description || model.display_name || model.name,
            max_tokens: 8192, // default for Gemini
            supports_streaming:
              model.supported_generation_methods?.includes(
                "streamGenerateContent",
              ) || true,
          }));
          modelsList = [...modelsList, ...geminiModels];
        }

        console.log("Processed models list:", modelsList);
        setModels(modelsList);
      }

      if (currentModelResponse) {
        // Response có thể có hoặc không có wrapper 'data'
        const responseData = currentModelResponse.data || currentModelResponse;
        const currentData = responseData.current_active || responseData;

        console.log("Current data to process:", currentData);

        setCurrentModel({
          name: currentData.model_name,
          model_name: currentData.model_name,
          provider: currentData.model_type,
          description: `${currentData.model_type} model`,
        });
      }
    } catch (error) {
      console.error("Error fetching models:", error);
      setError("Không thể tải danh sách models. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectModel = async (model) => {
    setError(null);
    setSuccessMessage(null);
    try {
      const modelName = model.name || model.model_name;
      const modelType = model.provider; // ollama hoặc gemini

      const response = await modelService.selectModel(modelType, modelName);

      console.log("Select model response:", response);

      // Luôn fetch lại current model sau khi select (không phụ thuộc vào response.success)
      setSuccessMessage(`Đã chọn model "${modelName}" thành công!`);

      // Refresh current model - parse đúng cấu trúc
      const currentModelResponse = await modelService.getCurrentModel();
      console.log("Current model after select:", currentModelResponse);

      if (currentModelResponse) {
        const responseData = currentModelResponse.data || currentModelResponse;
        const currentData = responseData.current_active || responseData;

        console.log("Setting current model to:", {
          name: currentData.model_name,
          model_name: currentData.model_name,
          provider: currentData.model_type,
          description: `${currentData.model_type} model`,
        });

        setCurrentModel({
          name: currentData.model_name,
          model_name: currentData.model_name,
          provider: currentData.model_type,
          description: `${currentData.model_type} model`,
        });
      }

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error selecting model:", error);
      setError(`Không thể chọn model. Vui lòng thử lại.`);
    }
  };

  const handleOpenTestModal = (model) => {
    setSelectedModelForTest(model);
    setTestResult(null);
    setTestPrompt("Xin chào, bạn là ai?");
    setTestModalOpen(true);
  };

  const handleTestModel = async () => {
    if (!selectedModelForTest || !testPrompt.trim()) return;

    setIsTesting(true);
    setTestResult(null);
    try {
      const modelName =
        selectedModelForTest.name || selectedModelForTest.model_name;
      const modelType = selectedModelForTest.provider;

      const response = await modelService.testModel(
        modelType,
        modelName,
        testPrompt,
      );
      if (response && response.data) {
        setTestResult({
          success: true,
          response: response.data.response || "Không có phản hồi từ model",
          time: response.data.time || "N/A",
        });
      }
    } catch (error) {
      console.error("Error testing model:", error);
      setTestResult({
        success: false,
        error: error.message || "Lỗi khi test model",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetModel = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn reset về model mặc định?"))
      return;

    setError(null);
    setSuccessMessage(null);
    try {
      const response = await modelService.resetModel();
      console.log("Reset model response:", response);

      // Reset thành công - fetch lại models và current model
      setSuccessMessage("Đã reset về model mặc định thành công!");
      await fetchModels(); // fetchModels sẽ tự động update currentModel
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("Error resetting model:", error);
      setError("Không thể reset model. Vui lòng thử lại.");
    }
  };

  const handleAddCustomModel = async (e) => {
    e.preventDefault();
    if (!customModelName.trim()) {
      setError("Vui lòng nhập tên model!");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const response = await modelService.addCustomModel(
        customModelType,
        customModelName.trim(),
      );
      const data = response.data || response;

      if (data && data.success) {
        setSuccessMessage(
          data.message ||
            `Đã thêm model custom "${customModelName}" thành công!`,
        );
        setCustomModelName("");
        await fetchModels();
      } else {
        throw new Error(
          data?.detail || data?.message || "Không thể thêm model.",
        );
      }
    } catch (error) {
      console.error("Error adding custom model:", error);
      setError(error.message || "Đã xảy ra lỗi khi thêm model.");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  if (loading) {
    return (
      <div className="models-loading">
        <FiRefreshCw className="spinning" />
        <p>Đang tải thông tin mô hình...</p>
      </div>
    );
  }

  return (
    <div className="model-management">
      <div className="models-header">
        <div className="models-info">
          <FiInfo />
          <div>
            <h3>Quản lý mô hình ngôn ngữ</h3>
            <p>
              Trang này cho phép bạn chọn và quản lý các mô hình LLM, test model
              và reset về mặc định.
            </p>
          </div>
        </div>
        <button className="reset-model-button" onClick={handleResetModel}>
          <FiRefreshCw />
          <span>Reset về mặc định</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <FiAlertCircle />
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <FiX />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert-success">
          <FiCheck />
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>
            <FiX />
          </button>
        </div>
      )}

      <div className="active-model-section">
        <h3>Mô hình đang hoạt động</h3>
        {currentModel ? (
          <div className="active-model-card">
            <div className="active-model-info">
              <div className="active-model-name">
                <h4>
                  {currentModel.name || currentModel.model_name || "Unknown"}
                </h4>
                {currentModel.provider && (
                  <span className={`provider-badge ${currentModel.provider}`}>
                    {currentModel.provider.toUpperCase()}
                  </span>
                )}
                <span className="active-badge">Đang hoạt động</span>
              </div>
              {currentModel.description && (
                <p className="active-model-description">
                  {currentModel.description}
                </p>
              )}
              {currentModel.provider && (
                <div className="active-model-stats">
                  <div className="active-model-stat">
                    <span className="stat-label">Provider</span>
                    <span className="stat-value">{currentModel.provider}</span>
                  </div>
                  {currentModel.max_tokens && (
                    <div className="active-model-stat">
                      <span className="stat-label">Max Tokens</span>
                      <span className="stat-value">
                        {currentModel.max_tokens}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="no-active-model">
            <FiAlertCircle />
            <p>
              Không có mô hình nào đang hoạt động. Vui lòng chọn một mô hình.
            </p>
          </div>
        )}
      </div>

      {/* Add Custom Model Section */}
      <div
        className="custom-model-section"
        style={{
          marginBottom: "2rem",
          padding: "1.5rem",
          backgroundColor: "#f8f9fa",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3 style={{ marginBottom: "1rem", color: "#1e293b" }}>
          Thêm cấu hình Model tuỳ chỉnh
        </h3>
        <p
          style={{
            fontSize: "0.875rem",
            color: "#64748b",
            marginBottom: "1rem",
          }}
        >
          Nhập tên mô hình (ví dụ: gemini-1.5-flash hoặc google/gemma-4-31b-it)
          để thêm vào danh sách, sau đó bạn có thể chọn để sử dụng. Các mô hình
          này sẽ được lưu ở phía hệ thống.
        </p>
        <form
          onSubmit={handleAddCustomModel}
          style={{ display: "flex", gap: "1rem", alignItems: "center" }}
        >
          <select
            value={customModelType}
            onChange={(e) => setCustomModelType(e.target.value)}
            style={{
              padding: "0.5rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="gemini">Gemini API</option>
            <option value="ollama">Ollama (Local)</option>
          </select>
          <input
            type="text"
            placeholder="Tên model (VD: gemma-4-31b-it)"
            value={customModelName}
            onChange={(e) => setCustomModelName(e.target.value)}
            style={{
              flex: 1,
              padding: "0.5rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
            }}
          />
          <button
            type="submit"
            disabled={loading || !customModelName.trim()}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: customModelName.trim() ? "#3b82f6" : "#94a3b8",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: customModelName.trim() ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            Thêm Model
          </button>
        </form>
      </div>

      <div className="all-models-section">
        <h3>Tất cả mô hình có sẵn</h3>
        {models.length === 0 ? (
          <div className="no-models">
            <FiAlertCircle />
            <p>Không có models nào có sẵn.</p>
          </div>
        ) : (
          <div className="models-list">
            {models.map((model, index) => {
              const modelName =
                model.name || model.model_name || `Model ${index + 1}`;
              const isActive =
                currentModel &&
                (currentModel.name === modelName ||
                  currentModel.model_name === modelName);
              return (
                <div
                  key={index}
                  className={`model-card ${isActive ? "active" : ""}`}
                >
                  <div className="model-header">
                    <div className="model-title-group">
                      <h4>{modelName}</h4>
                      {model.provider && (
                        <span className={`provider-badge ${model.provider}`}>
                          {model.provider.toUpperCase()}
                        </span>
                      )}
                    </div>
                    {isActive && (
                      <span className="model-active-badge">Đang hoạt động</span>
                    )}
                  </div>
                  {model.description && (
                    <p className="model-description">{model.description}</p>
                  )}
                  <div className="model-details">
                    {model.provider && (
                      <div className="model-detail">
                        <span className="detail-label">Provider</span>
                        <span className="detail-value">{model.provider}</span>
                      </div>
                    )}
                    {model.max_tokens && (
                      <div className="model-detail">
                        <span className="detail-label">Max Tokens</span>
                        <span className="detail-value">{model.max_tokens}</span>
                      </div>
                    )}
                  </div>
                  <div className="model-actions">
                    {!isActive && (
                      <button
                        className="activate-button"
                        onClick={() => handleSelectModel(model)}
                      >
                        <FiPower />
                        <span>Chọn model này</span>
                      </button>
                    )}
                    <button
                      className="test-button"
                      onClick={() => handleOpenTestModal(model)}
                    >
                      <FiPlayCircle />
                      <span>Test model</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {testModalOpen && (
        <div className="modal-overlay" onClick={() => setTestModalOpen(false)}>
          <div className="test-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                Test Model -{" "}
                {selectedModelForTest?.name || selectedModelForTest?.model_name}
              </h2>
              <button
                className="close-modal"
                onClick={() => setTestModalOpen(false)}
                disabled={isTesting}
              >
                <FiX />
              </button>
            </div>
            <div className="test-form">
              <div className="form-group">
                <label>Prompt test</label>
                <textarea
                  value={testPrompt}
                  onChange={(e) => setTestPrompt(e.target.value)}
                  placeholder="Nhập câu hỏi để test model"
                  rows={4}
                  disabled={isTesting}
                />
              </div>
              <button
                className="test-submit-button"
                onClick={handleTestModel}
                disabled={isTesting || !testPrompt.trim()}
              >
                {isTesting ? (
                  <>
                    <FiRefreshCw className="spinning" />
                    <span>Đang test...</span>
                  </>
                ) : (
                  <>
                    <FiPlayCircle />
                    <span>Chạy test</span>
                  </>
                )}
              </button>
              {testResult && (
                <div
                  className={`test-result ${
                    testResult.success ? "success" : "error"
                  }`}
                >
                  <h4>{testResult.success ? "Kết quả test" : "Lỗi"}</h4>
                  {testResult.success ? (
                    <>
                      <div className="test-response">
                        <strong>Phản hồi:</strong>
                        <p>{testResult.response}</p>
                      </div>
                      {testResult.time && (
                        <div className="test-time">
                          <strong>Thời gian phản hồi:</strong> {testResult.time}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="error-message">{testResult.error}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelManagement;
