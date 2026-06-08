import { API_ENDPOINTS, API_BASE_URL } from '../utils/constants';
// Uncomment when integrating with real API
import httpClient from '../utils/httpClient';

// No need to destructure anymore
// const { API_ENDPOINTS } = constants;

class AdminService {
  // User Management
  async getUsers() {
    // This would be a real API call in production
    // try {
    //   const response = await httpClient.get(API_ENDPOINTS.ADMIN_GET_USERS);
    //   return response;
    // } catch (error) {
    //   console.error('Error fetching users:', error);
    //   return {
    //     success: false,
    //     error: error.message || 'Failed to fetch users'
    //   };
    // }
    
    // For development, return mock data
    return {
      success: true,
      data: [
        {
          id: '60d21b4667d0d8992e610c85',
          username: 'user1',
          name: 'Nguyen Van A',
          studentCode: 'AT170001',
          studentClass: 'AT17A',
          role: 'user',
          status: 'active',
          createdAt: '2023-05-15T09:12:33Z',
          lastLogin: '2023-07-20T14:30:22Z',
          tokenLimit: 10000,
          requestsPerDay: 100
        },
        {
          id: '60d21b4667d0d8992e610c86',
          username: 'user2',
          name: 'Tran Thi B',
          studentCode: 'AT170002',
          studentClass: 'AT17A',
          role: 'user',
          status: 'active',
          createdAt: '2023-05-16T10:22:41Z',
          lastLogin: '2023-07-19T11:45:13Z',
          tokenLimit: 10000,
          requestsPerDay: 100
        },
        {
          id: '60d21b4667d0d8992e610c87',
          username: 'admin',
          name: 'Admin User',
          role: 'admin',
          status: 'active',
          createdAt: '2023-01-01T00:00:00Z',
          lastLogin: '2023-07-21T08:12:55Z',
          tokenLimit: null,
          requestsPerDay: null
        }
      ]
    };
  }

  async createUser(userData) {
    // This would be a real API call in production
    // try {
    //   const response = await httpClient.post(API_ENDPOINTS.ADMIN_CREATE_USER, userData);
    //   return response;
    // } catch (error) {
    //   console.error('Error creating user:', error);
    //   return {
    //     success: false,
    //     error: error.message || 'Failed to create user'
    //   };
    // }
    
    // For development, return mock success
    return {
      success: true,
      message: 'User created successfully',
      data: {
        id: Math.random().toString(36).substring(2, 15),
        ...userData,
        createdAt: new Date().toISOString(),
        status: 'active'
      }
    };
  }

  async updateUser(userId, userData) {
    // This would be a real API call in production
    // try {
    //   const response = await httpClient.put(`${API_ENDPOINTS.ADMIN_UPDATE_USER}/${userId}`, userData);
    //   return response;
    // } catch (error) {
    //   console.error('Error updating user:', error);
    //   return {
    //     success: false,
    //     error: error.message || 'Failed to update user'
    //   };
    // }
    
    // For development, return mock success
    return {
      success: true,
      message: 'User updated successfully',
      data: {
        id: userId,
        ...userData,
        updatedAt: new Date().toISOString()
      }
    };
  }

  async deleteUser(userId) {
    // This would be a real API call in production
    // try {
    //   const response = await httpClient.delete(`${API_ENDPOINTS.ADMIN_DELETE_USER}/${userId}`);
    //   return response;
    // } catch (error) {
    //   console.error('Error deleting user:', error);
    //   return {
    //     success: false,
    //     error: error.message || 'Failed to delete user'
    //   };
    // }
    
    // For development, return mock success
    return {
      success: true,
      message: 'User deleted successfully',
      data: {
        id: userId,
        deletedAt: new Date().toISOString()
      }
    };
  }

  // Stats Methods
  async getStats() {
    // Mock data for now
    return {
      success: true,
      data: {
        totalUsers: 150,
        activeUsers: 120,
        totalConversations: 1253,
        totalMessages: 7894,
        avgMessagesPerConversation: 6.3,
        avgResponseTime: 2.4, // seconds
        systemUptime: 99.8, // percentage
        mostActiveHours: [
          { hour: 9, count: 523 },
          { hour: 10, count: 745 },
          { hour: 11, count: 612 },
          { hour: 14, count: 502 },
          { hour: 15, count: 488 }
        ],
        messageTrend: [
          { date: '2023-07-15', count: 342 },
          { date: '2023-07-16', count: 289 },
          { date: '2023-07-17', count: 421 },
          { date: '2023-07-18', count: 392 },
          { date: '2023-07-19', count: 450 },
          { date: '2023-07-20', count: 501 },
          { date: '2023-07-21', count: 478 }
        ],
        userGrowth: [
          { date: '2023-07-01', count: 120 },
          { date: '2023-07-08', count: 132 },
          { date: '2023-07-15', count: 141 },
          { date: '2023-07-21', count: 150 }
        ],
        popularQueries: [
          { query: 'Điểm thi môn học X?', count: 145 },
          { query: 'Lịch thi học kỳ này?', count: 123 },
          { query: 'Quy định về điểm danh?', count: 97 },
          { query: 'Cách đăng ký học phần?', count: 86 },
          { query: 'Thời gian nhận bằng tốt nghiệp?', count: 78 }
        ],
        responseQuality: {
          excellent: 35,
          good: 45,
          average: 15,
          poor: 5
        }
      }
    };
  }

  // Conversation Methods
  async getConversations(params = {}) {
    // Mock data for now
    const mockConversations = [
      {
        id: '60d21b4667d0d8992e610c90',
        userId: '60d21b4667d0d8992e610c85',
        username: 'user1',
        startTime: '2023-07-20T09:10:12Z',
        endTime: '2023-07-20T09:15:45Z',
        messageCount: 8,
        topic: 'Thông tin về lịch thi',
        status: 'completed',
        feedbackRating: 4,
        summary: 'User asked about exam schedule and registration process'
      },
      {
        id: '60d21b4667d0d8992e610c91',
        userId: '60d21b4667d0d8992e610c86',
        username: 'user2',
        startTime: '2023-07-20T10:22:33Z',
        endTime: '2023-07-20T10:28:12Z',
        messageCount: 6,
        topic: 'Quy định về điểm danh',
        status: 'completed',
        feedbackRating: 5,
        summary: 'User inquired about attendance policy and absence rules'
      },
      {
        id: '60d21b4667d0d8992e610c92',
        userId: '60d21b4667d0d8992e610c85',
        username: 'user1',
        startTime: '2023-07-21T14:05:22Z',
        endTime: '2023-07-21T14:12:45Z',
        messageCount: 9,
        topic: 'Hỏi về điểm thi',
        status: 'completed',
        feedbackRating: 3,
        summary: 'User asked about exam scores and grading policy'
      }
    ];
    
    // Apply basic filtering and pagination if provided
    let filteredConversations = [...mockConversations];
    
    if (params.userId) {
      filteredConversations = filteredConversations.filter(c => c.userId === params.userId);
    }
    
    if (params.startDate && params.endDate) {
      const start = new Date(params.startDate);
      const end = new Date(params.endDate);
      filteredConversations = filteredConversations.filter(c => {
        const date = new Date(c.startTime);
        return date >= start && date <= end;
      });
    }
    
    // Sort by most recent first
    filteredConversations.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    
    return {
      success: true,
      data: filteredConversations,
      total: filteredConversations.length
    };
  }

  async getConversationDetails(conversationId) {
    // Mock data for now
    return {
      success: true,
      data: {
        id: conversationId,
        userId: '60d21b4667d0d8992e610c85',
        username: 'user1',
        startTime: '2023-07-20T09:10:12Z',
        endTime: '2023-07-20T09:15:45Z',
        messages: [
          {
            id: 'm1',
            role: 'user',
            content: 'Xin chào, tôi muốn hỏi về lịch thi học kỳ này?',
            timestamp: '2023-07-20T09:10:12Z'
          },
          {
            id: 'm2',
            role: 'assistant',
            content: 'Chào bạn, lịch thi học kỳ này được công bố trên trang web của trường từ ngày 15/7. Bạn có thể truy cập vào mục "Đào tạo" > "Lịch thi" để xem chi tiết. Bạn cần thông tin về môn học cụ thể nào không?',
            timestamp: '2023-07-20T09:10:45Z'
          },
          {
            id: 'm3',
            role: 'user',
            content: 'Tôi muốn biết lịch thi môn Mạng máy tính',
            timestamp: '2023-07-20T09:11:30Z'
          },
          {
            id: 'm4',
            role: 'assistant',
            content: 'Môn Mạng máy tính sẽ thi vào ngày 25/07/2023, ca sáng từ 8h00 đến 9h30, tại phòng H1-301. Bạn nhớ mang theo thẻ sinh viên để dự thi nhé.',
            timestamp: '2023-07-20T09:12:15Z'
          }
        ],
        topic: 'Thông tin về lịch thi',
        status: 'completed',
        feedbackRating: 4,
        feedbackComment: 'Thông tin rõ ràng và hữu ích',
        summary: 'User asked about exam schedule, specifically for the Computer Networks course.'
      }
    };
  }

  // RAG Management Methods
  async getTrainingFiles(folder = null) {
    try {
      let url = API_ENDPOINTS.ADMIN_LIST_TRAINING_FILES;
      if (folder) {
        url = `${url}?folder=${encodeURIComponent(folder)}`;
      }
      console.log('Calling API:', url);
      const response = await httpClient.get(url);
      console.log('Raw API response for files:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error fetching training files:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch training files'
      };
    }
  }

  async uploadTrainingFile(file, folder) {
    try {
      if (!folder || folder.trim() === '') {
        throw new Error('Department folder is required for file upload');
      }

      const formData = new FormData();
      formData.append('file', file);
      // folder được truyền dưới dạng query parameter, không phải trong FormData
      
      // Xây dựng URL với query parameter folder
      const url = `${API_ENDPOINTS.ADMIN_UPLOAD_TRAINING_FILE}?folder=${encodeURIComponent(folder)}`;
      
      console.log('Uploading file to:', url);
      console.log('File will be uploaded to folder:', folder);
      
      // Sử dụng phương thức upload thay vì post, và KHÔNG thiết lập header Content-Type
      const response = await httpClient.upload(url, formData);
      
      console.log('Upload response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error uploading training file:', error);
      return {
        success: false,
        message: error.message || 'Failed to upload training file'
      };
    }
  }

  async deleteTrainingFile(filename, folder) {
    try {
      if (!folder || folder.trim() === '') {
        throw new Error('Department folder is required for file deletion');
      }

      const url = `${API_ENDPOINTS.ADMIN_DELETE_TRAINING_FILE}/${encodeURIComponent(filename)}?folder=${encodeURIComponent(folder)}`;
      console.log('Deleting file:', url);
      const response = await httpClient.delete(url);
      console.log('Delete response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error deleting training file:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete training file'
      };
    }
  }

  async createFolder(folderName) {
    try {
      console.log('Creating folder:', folderName);
      const response = await httpClient.post(API_ENDPOINTS.ADMIN_CREATE_FOLDER, { folder_name: folderName });
      console.log('Create folder response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error creating folder:', error);
      return {
        success: false,
        message: error.message || 'Failed to create folder'
      };
    }
  }
  
  async createSubfolder(parentFolder, subfolderName) {
    try {
      console.log('Creating subfolder:', subfolderName, 'in parent folder:', parentFolder);
      const response = await httpClient.post(API_ENDPOINTS.ADMIN_CREATE_SUBFOLDER, { 
        parent_folder: parentFolder, 
        subfolder_name: subfolderName 
      });
      console.log('Create subfolder response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error creating subfolder:', error);
      return {
        success: false,
        message: error.message || 'Failed to create subfolder'
      };
    }
  }
  
  async deleteFolder(folderName, deleteFiles = true) {
    try {
      // Fix for folder names with forward slashes - replace with custom separator
      // Khi gửi đến server, chúng ta sẽ sử dụng URL encoding cho cả đường dẫn
      console.log('Original folder name to delete:', folderName);
      
      // Tạo URL bằng cách nối cơ sở và đường dẫn, sau đó mã hóa toàn bộ
      const baseUrl = API_ENDPOINTS.ADMIN_DELETE_FOLDER;
      const encodedFolderName = encodeURIComponent(folderName);
      const url = `${baseUrl}/${encodedFolderName}?delete_files=${deleteFiles}`;
      
      console.log('Deleting folder with URL:', url);
      const response = await httpClient.delete(url);
      console.log('Delete folder response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error deleting folder:', error);
      return {
        success: false,
        message: error.message || 'Failed to delete folder'
      };
    }
  }
  
  async getFolders() {
    try {
      console.log('Fetching folders');
      const response = await httpClient.get(API_ENDPOINTS.ADMIN_LIST_FOLDERS);
      console.log('Folders response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error fetching folders:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch folders'
      };
    }
  }
  
  async renameFolder(oldName, newName) {
    try {
      console.log('Renaming folder:', oldName, 'to', newName);
      const response = await httpClient.put(API_ENDPOINTS.ADMIN_RENAME_FOLDER, { 
        old_name: oldName, 
        new_name: newName 
      });
      console.log('Rename folder response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error renaming folder:', error);
      return {
        success: false,
        message: error.message || 'Failed to rename folder'
      };
    }
  }
  
  async rebuildRagIndex() {
    try {
      console.log('Rebuilding full RAG index at:', API_ENDPOINTS.ADMIN_REBUILD_RAG_INDEX);
      const response = await httpClient.post(API_ENDPOINTS.ADMIN_REBUILD_RAG_INDEX);
      console.log('Rebuild response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error rebuilding RAG index:', error);
      return {
        success: false,
        message: error.message || 'Failed to rebuild RAG index'
      };
    }
  }

  async rebuildDepartmentRagIndex(department) {
    try {
      console.log('Rebuilding RAG index for department:', department);
      const response = await httpClient.post(API_ENDPOINTS.ADMIN_REBUILD_DEPARTMENT_RAG_INDEX, department);
      console.log('Rebuild department response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error rebuilding department RAG index:', error);
      return {
        success: false,
        message: error.message || 'Failed to rebuild department RAG index'
      };
    }
  }

  async getDepartments() {
    try {
      console.log('Fetching available departments');
      const response = await httpClient.get(API_ENDPOINTS.ADMIN_LIST_DEPARTMENTS);
      console.log('Departments response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error fetching departments:', error);
      return {
        success: false,
        message: error.message || 'Failed to fetch departments'
      };
    }
  }
  
  async editFile(filePath, content) {
    try {
      console.log('Editing file:', filePath);
      const response = await httpClient.put(API_ENDPOINTS.ADMIN_EDIT_FILE, { 
        file_path: filePath, 
        content: content 
      });
      console.log('Edit file response:', response);
      return response || { success: false, message: 'No response data' };
    } catch (error) {
      console.error('Error editing file:', error);
      return {
        success: false,
        message: error.message || 'Failed to edit file'
      };
    }
  }
  
  async downloadFile(filePath) {
    try {
      console.log('Downloading file:', filePath);
      
      // Check if token exists - try both 'token' and 'accessToken'
      const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
      console.log('Token exists:', !!token);
      console.log('Token preview:', token ? `${token.substring(0, 20)}...` : 'null');
      
      // If no token, try direct download without authentication
      if (!token) {
        console.warn('No authentication token found. Attempting direct download...');
        // Try direct download without auth first
        try {
          const encodedFilePath = encodeURIComponent(filePath);
          const url = `${API_BASE_URL}${API_ENDPOINTS.ADMIN_DOWNLOAD_FILE}/${encodedFilePath}`;
          console.log('Direct download URL:', url);
          window.open(url, '_blank');
          return { success: true, message: 'Đã mở file trong tab mới (không có xác thực)' };
        } catch (directError) {
          console.error('Direct download failed:', directError);
          throw new Error('No authentication token found. Please login to download files.');
        }
      }
      
      // Mã hóa đường dẫn file để tránh lỗi với các ký tự đặc biệt
      const encodedFilePath = encodeURIComponent(filePath);
      console.log('Encoded file path:', encodedFilePath);
      
      const url = `${API_BASE_URL}${API_ENDPOINTS.ADMIN_DOWNLOAD_FILE}/${encodedFilePath}`;
      console.log('Download URL:', url);
      
      // Tạo yêu cầu HTTP với responseType là blob để xử lý file binary
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        // Log response text for debugging
        const responseText = await response.text();
        console.error('Response error text:', responseText);
        throw new Error(`HTTP error! status: ${response.status} - ${responseText}`);
      }
      
      // Lấy blob từ response
      const blob = await response.blob();
      console.log('Blob size:', blob.size, 'type:', blob.type);
      
      // Lấy tên file từ header hoặc từ đường dẫn
      let filename = filePath.split('/').pop();
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      console.log('Final filename:', filename);
      
      // Tạo URL object cho blob
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Tạo element anchor để tự động tải xuống
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      link.style.display = 'none';
      
      // Thêm vào DOM, click, và loại bỏ
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Giải phóng blob URL
      window.URL.revokeObjectURL(blobUrl);
      
      return { success: true, message: `Đã tải xuống ${filename}` };
    } catch (error) {
      console.error('Error downloading file:', error);
      
      // Fallback: mở trong tab mới nếu tải xuống trực tiếp thất bại
      try {
        const encodedFilePath = encodeURIComponent(filePath);
        const url = `${API_BASE_URL}${API_ENDPOINTS.ADMIN_DOWNLOAD_FILE}/${encodedFilePath}`;
        console.log('Fallback: opening URL in new tab:', url);
        window.open(url, '_blank');
        return { success: true, message: 'Đã mở file trong tab mới' };
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        return {
          success: false,
          message: error.message || 'Failed to download file'
        };
      }
    }
  }
}

const adminService = new AdminService();
export default adminService;
