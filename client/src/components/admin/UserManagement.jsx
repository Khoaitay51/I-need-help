import React, { useEffect, useState } from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiSearch,
  FiTrash2,
  FiToggleLeft,
  FiToggleRight,
  FiX,
} from "react-icons/fi";
import "./UserManagement.css";
import userService from "../../services/userService";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userService.getAllUsers();
      if (response.success) {
        setUsers(response.data || []);
      } else {
        setError(response.error || "Không thể tải danh sách người dùng");
        setUsers([]);
      }
    } catch (err) {
      setError(err.message || "Không thể tải danh sách người dùng");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    if (user.role?.toLowerCase() === "admin") {
      return false;
    }

    const searchLower = search.toLowerCase();
    return (
      user.username?.toLowerCase().includes(searchLower) ||
      user.studentCode?.toLowerCase().includes(searchLower)
    );
  });

  const showSuccess = (message) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleToggleActive = async (user) => {
    const nextActive = !user.isActive;
    const response = await userService.updateUser(user.id, {
      isActive: nextActive,
    });

    if (response.success) {
      setUsers((prev) =>
        prev.map((item) =>
          item.id === user.id ? { ...item, isActive: nextActive } : item,
        ),
      );
      showSuccess(
        nextActive ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản",
      );
    } else {
      setError(response.error || "Không thể cập nhật trạng thái tài khoản");
    }
  };

  const confirmDeleteUser = (user) => {
    setUserToDelete(user);
    setIsConfirmDeleteOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setLoading(true);
      const response = await userService.deleteUser(userToDelete.id);

      if (response.success) {
        setUsers((prev) => prev.filter((user) => user.id !== userToDelete.id));
        setIsConfirmDeleteOpen(false);
        setUserToDelete(null);
        showSuccess("Xóa người dùng thành công");
      } else {
        setError(response.error || "Không thể xóa người dùng");
      }
    } catch (err) {
      setError(err.message || "Không thể xóa người dùng");
    } finally {
      setLoading(false);
      setIsConfirmDeleteOpen(false);
    }
  };

  if (loading && users.length === 0) {
    return <div className="users-loading">Đang tải dữ liệu người dùng...</div>;
  }

  return (
    <div className="user-management">
      {error && (
        <div className="error-message">
          <FiAlertTriangle />
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <FiX />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          <FiCheck />
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)}>
            <FiX />
          </button>
        </div>
      )}

      <div className="users-header">
        <div className="users-search">
          <FiSearch />
          <input
            type="text"
            placeholder="Tìm theo username, role hoặc mã sinh viên..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Vai trò</th>
              <th>Mã sinh viên</th>
              <th>Trạng thái</th>
              <th>Đăng nhập cuối</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td>{user.username || "-"}</td>
                  <td>
                    <span className={`role-badge ${user.role}`}>
                      {user.role === "admin" ? "Admin" : "Người dùng"}
                    </span>
                  </td>
                  <td>{user.studentCode || "-"}</td>
                  <td>
                    <span
                      className={`status-badge ${
                        user.isActive ? "active" : "inactive"
                      }`}
                    >
                      {user.isActive ? "Hoạt động" : "Bị khóa"}
                    </span>
                  </td>
                  <td>
                    {user.lastLogin
                      ? new Date(user.lastLogin).toLocaleString("vi-VN")
                      : "Chưa đăng nhập"}
                  </td>
                  <td>
                    <div className="user-actions">
                      <button
                        className="edit-button"
                        onClick={() => handleToggleActive(user)}
                        title={user.isActive ? "Khóa tài khoản" : "Mở khóa tài khoản"}
                      >
                        {user.isActive ? <FiToggleRight /> : <FiToggleLeft />}
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => confirmDeleteUser(user)}
                        title="Xóa người dùng"
                      >
                        <FiTrash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="no-results">
                  Không tìm thấy người dùng phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isConfirmDeleteOpen && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <div className="confirm-icon">
              <FiAlertTriangle />
            </div>
            <h3>Xác nhận xóa người dùng</h3>
            <p>
              Bạn có chắc chắn muốn xóa người dùng{" "}
              <strong>{userToDelete?.username}</strong>? Hành động này không
              thể hoàn tác.
            </p>
            <div className="confirm-actions">
              <button
                className="cancel-button"
                onClick={() => setIsConfirmDeleteOpen(false)}
                disabled={loading}
              >
                <FiX />
                <span>Hủy bỏ</span>
              </button>
              <button
                className="confirm-delete-button"
                onClick={handleDeleteUser}
                disabled={loading}
              >
                <FiTrash2 />
                <span>{loading ? "Đang xóa..." : "Xác nhận xóa"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
