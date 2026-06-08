import httpClient from "../utils/httpClient";
import { API_ENDPOINTS } from "../utils/constants";

/**
 * Dịch vụ quản lý các mô hình LLM
 */
const modelService = {
  /**
   * Lấy danh sách tất cả các mô hình
   * @returns {Promise<Array>} Danh sách các mô hình
   */
  getAllModels: async () => {
    try {
      const response = await httpClient.get(API_ENDPOINTS.MODELS.GET_ALL);
      return response.data || [];
    } catch (error) {
      console.error("Error fetching models:", error);
      throw error;
    }
  },

  /**
   * Lấy thông tin mô hình đang hoạt động
   * @returns {Promise<Object>} Thông tin mô hình đang hoạt động
   */
  getActiveModel: async () => {
    try {
      const response = await httpClient.get(API_ENDPOINTS.MODELS.GET_ACTIVE);
      return response.data || null;
    } catch (error) {
      console.error("Error fetching active model:", error);
      throw error;
    }
  },

  /**
   * Kích hoạt một mô hình
   * @param {string} modelId - ID của mô hình cần kích hoạt
   * @returns {Promise<Object>} Kết quả kích hoạt
   */
  activateModel: async (modelId) => {
    try {
      const response = await httpClient.post(
        API_ENDPOINTS.MODELS.ACTIVATE(modelId),
      );
      return response;
    } catch (error) {
      console.error("Error activating model:", error);
      throw error;
    }
  },

  /**
   * Cập nhật tham số của một mô hình
   * @param {string} modelId - ID của mô hình cần cập nhật
   * @param {Object} params - Các tham số mới
   * @returns {Promise<Object>} Kết quả cập nhật
   */
  updateModelParams: async (modelId, params) => {
    try {
      const response = await httpClient.put(
        API_ENDPOINTS.MODELS.UPDATE_PARAMS(modelId),
        params,
      );
      return response;
    } catch (error) {
      console.error("Error updating model parameters:", error);
      throw error;
    }
  },

  /**
   * Tải lên một mô hình mới
   * @param {Object} modelData - Thông tin mô hình mới
   * @returns {Promise<Object>} Kết quả tải lên
   */
  uploadModel: async (modelData) => {
    try {
      const response = await httpClient.post(
        API_ENDPOINTS.MODELS.UPLOAD,
        modelData,
      );
      return response;
    } catch (error) {
      console.error("Error uploading model:", error);
      throw error;
    }
  },

  /**
   * Lấy danh sách models có sẵn (Admin)
   * @returns {Promise<Object>} Danh sách models có sẵn
   */
  getAvailableModels: async () => {
    try {
      const response = await httpClient.get(API_ENDPOINTS.ADMIN_GET_MODELS);
      return response;
    } catch (error) {
      console.error("Error fetching available models:", error);
      throw error;
    }
  },

  /**
   * Thêm cấu hình model tuỳ chỉnh (Admin)
   * @param {string} modelType - Loại model (ollama hoặc gemini)
   * @param {string} modelName - Tên model
   */
  addCustomModel: async (modelType, modelName) => {
    try {
      const response = await httpClient.post("/api/admin/models/custom", {
        model_type: modelType,
        model_name: modelName,
      });
      return response;
    } catch (error) {
      console.error("Error adding custom model:", error);
      throw error;
    }
  },

  /**
   * Lấy model hiện tại (Admin)
   * @returns {Promise<Object>} Model hiện tại
   */
  getCurrentModel: async () => {
    try {
      const response = await httpClient.get(
        API_ENDPOINTS.ADMIN_GET_CURRENT_MODEL,
      );
      return response;
    } catch (error) {
      console.error("Error fetching current model:", error);
      throw error;
    }
  },

  /**
   * Chọn model (Admin)
   * @param {string} modelType - Loại model (ollama hoặc gemini)
   * @param {string} modelName - Tên model cần chọn
   * @returns {Promise<Object>} Kết quả chọn model
   */
  selectModel: async (modelType, modelName) => {
    try {
      const response = await httpClient.post(API_ENDPOINTS.ADMIN_SELECT_MODEL, {
        model_type: modelType,
        model_name: modelName,
      });
      return response;
    } catch (error) {
      console.error("Error selecting model:", error);
      throw error;
    }
  },

  /**
   * Test model (Admin)
   * @param {string} modelType - Loại model (ollama hoặc gemini)
   * @param {string} modelName - Tên model cần test
   * @param {string} testMessage - Message để test
   * @returns {Promise<Object>} Kết quả test
   */
  testModel: async (
    modelType,
    modelName,
    testMessage = "Hello, how are you?",
  ) => {
    try {
      const response = await httpClient.post(API_ENDPOINTS.ADMIN_TEST_MODEL, {
        model_type: modelType,
        model_name: modelName,
        test_message: testMessage,
      });
      return response;
    } catch (error) {
      console.error("Error testing model:", error);
      throw error;
    }
  },

  /**
   * Reset model về mặc định (Admin)
   * @returns {Promise<Object>} Kết quả reset
   */
  resetModel: async () => {
    try {
      const response = await httpClient.post(API_ENDPOINTS.ADMIN_RESET_MODEL);
      return response;
    } catch (error) {
      console.error("Error resetting model:", error);
      throw error;
    }
  },
};

export default modelService;
