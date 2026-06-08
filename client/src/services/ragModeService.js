/**
 * RAG Mode Service
 * Handles API calls for RAG mode management (traditional vs GraphRAG)
 */
import httpClient from "../utils/httpClient";
import { API_ENDPOINTS } from "../utils/constants";

const ragModeService = {
  /**
   * Get current RAG mode and configuration
   * @returns {Promise<Object>} Current RAG mode info
   */
  getRagMode: async () => {
    try {
      const response = await httpClient.get(API_ENDPOINTS.ADMIN_GET_RAG_MODE);
      return response;
    } catch (error) {
      console.error("Error fetching RAG mode:", error);
      throw error;
    }
  },

  /**
   * Set RAG mode (traditional or graph-based)
   * @param {string} mode - "rag" for traditional or "graph_rag" for GraphRAG
   * @returns {Promise<Object>} Updated mode info
   */
  setRagMode: async (mode) => {
    try {
      const response = await httpClient.post(API_ENDPOINTS.ADMIN_SET_RAG_MODE, {
        mode: mode,
      });
      return response;
    } catch (error) {
      console.error("Error setting RAG mode:", error);
      throw error;
    }
  },

  /**
   * Get RAG retriever statistics
   * @returns {Promise<Object>} RAG stats
   */
  getRagStats: async () => {
    try {
      const response = await httpClient.get(API_ENDPOINTS.ADMIN_GET_RAG_STATS);
      return response;
    } catch (error) {
      console.error("Error fetching RAG stats:", error);
      throw error;
    }
  },
};

export default ragModeService;
