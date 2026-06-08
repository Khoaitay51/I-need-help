import React, { useState, useEffect } from "react";
import {
  FiSearch,
  FiCalendar,
  FiUser,
  FiMessageCircle,
  FiChevronDown,
  FiChevronRight,
  FiDownload,
  FiFilter,
} from "react-icons/fi";
import "./ConversationLogs.css";
import userService from "../../services/userService";
import httpClient from "../../utils/httpClient";
import constants from "../../utils/constants";
import { normalizeTextContent } from "../../utils/textUtils";

const ConversationLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    username: "",
    status: "all",
  });
  const [expandedConversationId, setExpandedConversationId] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        // Fetch user data for matching IDs to usernames and names
        console.log("=== FETCHING USERS ===");
        const userResponse = await userService.getAllUsers();
        console.log("userResponse:", userResponse);

        // Handle multiple response structures
        let users = [];
        if (userResponse.success) {
          // Try multiple ways to extract users array
          if (Array.isArray(userResponse.data)) {
            users = userResponse.data;
          } else if (
            userResponse.data &&
            Array.isArray(userResponse.data.data)
          ) {
            users = userResponse.data.data;
          } else if (
            userResponse.data &&
            userResponse.data.data &&
            Array.isArray(userResponse.data.data.data)
          ) {
            users = userResponse.data.data.data;
          }
        }

        console.log("Users array:", users);
        console.log(`Total users fetched: ${users.length}`);

        // Debug: Log first 3 users structure
        if (users.length > 0) {
          console.log(
            "=== SAMPLE USER STRUCTURES (Using username for display) ===",
          );
          users.slice(0, 3).forEach((user, idx) => {
            console.log(`User ${idx}:`, {
              id: user.id,
              _id: user._id,
              username: user.username, // This is what we'll display
              name: user.name,
              email: user.email,
              keys: Object.keys(user),
            });
          });
        }

        const userMap = {};
        // Backend returns: id, username (main identifier), name (student_name), studentCode, studentClass, etc.
        if (users && users.length > 0) {
          users.forEach((user) => {
            // Backend response uses 'id' field for user ID
            const userId = user.id || user._id;
            // Use username as the display name (this is what's stored in DB)
            const displayUsername = user.username || "Người dùng";

            userMap[userId] = {
              id: userId,
              username: displayUsername,
              fullName: displayUsername, // Use username for display
              name: user.name, // Store name separately if needed
              email: user.email,
              studentCode: user.studentCode || user.student_code,
            };

            console.log(
              `[USER_MAP] ID: ${userId} -> Username: ${displayUsername}`,
            );
          });
        }

        console.log("[USER_MAP_COMPLETE]", userMap);

        // Create query parameters for filtering
        const queryParams = new URLSearchParams();

        if (filters.startDate)
          queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.username) queryParams.append("username", filters.username);
        if (filters.status !== "all")
          queryParams.append("status", filters.status);

        // Fetch conversations using httpClient
        const { API_ENDPOINTS } = constants;
        console.log(
          "Calling API:",
          `${API_ENDPOINTS.CONVERSATIONS}?${queryParams.toString()}&trace=1`,
        );
        const response = await httpClient.get(
          `${API_ENDPOINTS.CONVERSATIONS}?${queryParams.toString()}&trace=1`,
        );
        console.log("API response:", response);

        // Phản hồi API có thể có cấu trúc khác nhau, xử lý cả hai trường hợp
        const conversationsData =
          response.data ||
          (response.statusCode === 200 && response.data ? response.data : []);

        console.log(`=== CONVERSATIONS DATA ===`);
        console.log(
          `Total conversations: ${Array.isArray(conversationsData) ? conversationsData.length : "N/A"}`,
        );
        if (Array.isArray(conversationsData) && conversationsData.length > 0) {
          console.log("=== SAMPLE CONVERSATION STRUCTURES ===");
          conversationsData.slice(0, 3).forEach((conv, idx) => {
            console.log(`Conv ${idx}:`, {
              _id: conv._id,
              user_id: conv.user_id,
              created_at: conv.created_at,
              keys: Object.keys(conv),
            });
          });
        }

        if (conversationsData && conversationsData.length > 0) {
          // Convert API response to our format
          const conversationPromises = conversationsData.map(async (conv) => {
            // Fetch messages for each conversation
            let messages = [];
            try {
              const messagesResponse = await httpClient.get(
                `${API_ENDPOINTS.MESSAGES}/${conv._id}`,
              );
              messages =
                messagesResponse.data ||
                (messagesResponse.statusCode === 200 && messagesResponse.data
                  ? messagesResponse.data
                  : []);
            } catch (error) {
              console.error(
                `Error fetching messages for conversation ${conv._id}:`,
                error,
              );
            }

            // Calculate total tokens and find errors
            const totalTokens = messages
              .filter((m) => !m.is_user)
              .reduce((sum, m) => {
                const content = normalizeTextContent(m.content);
                // Estimate token count (4 chars per token)
                const tokens = Math.ceil(content.length / 4);
                return sum + tokens;
              }, 0);

            // Check if any errors in conversation
            const hasError = messages.some(
              (m) =>
                normalizeTextContent(m.content).toLowerCase().includes("error") ||
                normalizeTextContent(m.content).toLowerCase().includes("lỗi"),
            );

            // Generate conversation title from first user message or use date
            let title = "Cuộc hội thoại";
            const firstUserMessage = messages.find((m) => m.is_user);
            if (firstUserMessage && firstUserMessage.content) {
              title = normalizeTextContent(firstUserMessage.content).substring(0, 50).trim();
              if (title.length === 50) title += "...";
            } else {
              // If no messages, use date
              const date = new Date(conv.created_at);
              title = `Hội thoại - ${date.toLocaleDateString("vi-VN")}`;
            }

            // Get username from userMap
            const userId = conv.user_id;
            let displayName = `Người dùng (${userId?.substring(0, 8) || "unknown"}...)`;

            console.log(`\n=== LOOKING UP USER ===`);
            console.log(`Conv ID: ${conv._id}`);
            console.log(`Looking for userId: '${userId}'`);
            console.log(
              `userMap keys: ${Object.keys(userMap).slice(0, 5).join(", ")}...`,
            );
            console.log(`userMap[userId]: ${JSON.stringify(userMap[userId])}`);

            if (userMap[userId]) {
              displayName =
                userMap[userId].username ||
                userMap[userId].fullName ||
                displayName;
              console.log(`✅ FOUND: '${displayName}'`);
            } else {
              console.log(`❌ NOT FOUND in userMap`);
            }

            return {
              id: conv._id,
              title: title,
              username: displayName,
              userId: conv.user_id,
              startTime: conv.created_at,
              endTime: conv.updated_at,
              messageCount: messages.length,
              status: hasError ? "error" : "success",
              totalTokens: totalTokens,
              messages: messages.map((m) => ({
                id: m._id,
                sender: m.is_user ? "user" : "bot",
                content: normalizeTextContent(m.content),
                timestamp: m.created_at,
                tokens: m.is_user ? 0 : Math.ceil(normalizeTextContent(m.content).length / 4), // Estimate tokens
              })),
            };
          });

          const processedLogs = await Promise.all(conversationPromises);

          // Apply search filter
          const filteredLogs = processedLogs.filter((log) => {
            if (!search) return true;

            // Search in username, title and message content
            return (
              log.username.toLowerCase().includes(search.toLowerCase()) ||
              log.title.toLowerCase().includes(search.toLowerCase()) ||
              log.messages.some((m) =>
                normalizeTextContent(m.content).toLowerCase().includes(search.toLowerCase()),
              )
            );
          });

          setLogs(filteredLogs);
        } else {
          console.warn("No conversations found in API response");
          setLogs([]);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching logs:", error);
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    // Thêm độ trễ nhỏ để đảm bảo token đã được thiết lập đúng
    const timer = setTimeout(() => {
      fetchLogs();
    }, 500);

    return () => clearTimeout(timer);
  }, [filters, search]); // Removed constants from dependencies

  const toggleConversation = (id) => {
    if (expandedConversationId === id) {
      setExpandedConversationId(null);
    } else {
      setExpandedConversationId(id);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const toggleFilterPanel = () => {
    setIsFilterOpen(!isFilterOpen);
  };

  const resetFilters = () => {
    setFilters({
      startDate: "",
      endDate: "",
      username: "",
      status: "all",
    });
    setSearch("");
  };

  const exportLogs = () => {
    try {
      // Convert logs to CSV format
      const headers = [
        "Tên cuộc hội thoại",
        "Người dùng",
        "Thời gian bắt đầu",
        "Thời gian kết thúc",
        "Số tin nhắn",
        "Tokens sử dụng",
        "Trạng thái",
      ];

      const csvRows = [];

      // Add header row
      csvRows.push(headers.join(","));

      // Add data rows
      filteredLogs.forEach((log) => {
        const row = [
          log.title,
          log.username,
          formatDateTime(log.startTime),
          formatDateTime(log.endTime),
          log.messageCount,
          log.totalTokens,
          log.status === "success" ? "Thành công" : "Lỗi",
        ];

        // Escape commas in content
        const escapedRow = row.map((value) => {
          const stringValue = String(value);
          if (
            stringValue.includes(",") ||
            stringValue.includes('"') ||
            stringValue.includes("\n")
          ) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        });

        csvRows.push(escapedRow.join(","));
      });

      const csvString = csvRows.join("\n");

      // Create a blob and download
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `conversation_logs_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting logs:", error);
      alert("Có lỗi khi xuất logs. Vui lòng thử lại sau.");
    }
  };

  const formatDateTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString("vi-VN");
  };

  // Filter logs based on search and filters
  const filteredLogs = logs.filter((log) => {
    if (
      search &&
      !log.username.includes(search) &&
      !log.messages.some((m) =>
        normalizeTextContent(m.content).toLowerCase().includes(search.toLowerCase()),
      )
    ) {
      return false;
    }

    if (filters.username && !log.username.includes(filters.username)) {
      return false;
    }

    if (filters.status !== "all" && log.status !== filters.status) {
      return false;
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      const logDate = new Date(log.startTime);
      if (logDate < startDate) return false;
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999); // End of the day
      const logDate = new Date(log.startTime);
      if (logDate > endDate) return false;
    }

    return true;
  });

  if (loading) {
    return <div className="logs-loading">Đang tải dữ liệu...</div>;
  }

  return (
    <div className="conversation-logs">
      <div className="logs-header">
        <div className="logs-search">
          <FiSearch />
          <input
            type="text"
            placeholder="Tìm kiếm hội thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="logs-actions">
          <button className="filter-button" onClick={toggleFilterPanel}>
            <FiFilter />
            <span>Bộ lọc</span>
          </button>

          <button className="export-button" onClick={exportLogs}>
            <FiDownload />
            <span>Xuất logs</span>
          </button>
        </div>
      </div>

      {isFilterOpen && (
        <div className="logs-filter-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label>
                <FiCalendar />
                <span>Từ ngày</span>
              </label>
              <input
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="filter-group">
              <label>
                <FiCalendar />
                <span>Đến ngày</span>
              </label>
              <input
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
              />
            </div>

            <div className="filter-group">
              <label>
                <FiUser />
                <span>Người dùng</span>
              </label>
              <input
                type="text"
                name="username"
                value={filters.username}
                onChange={handleFilterChange}
                placeholder="Tên người dùng"
              />
            </div>

            <div className="filter-group">
              <label>
                <FiMessageCircle />
                <span>Trạng thái</span>
              </label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
              >
                <option value="all">Tất cả</option>
                <option value="success">Thành công</option>
                <option value="error">Lỗi</option>
              </select>
            </div>
          </div>

          <div className="filter-actions">
            <button onClick={resetFilters}>Đặt lại bộ lọc</button>
          </div>
        </div>
      )}

      <div className="logs-table-container">
        <table className="logs-table">
          <thead>
            <tr>
              <th></th>
              <th>Tên cuộc hội thoại</th>
              <th>Người dùng</th>
              <th>Thời gian bắt đầu</th>
              <th>Số tin nhắn</th>
              <th>Tokens sử dụng</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <React.Fragment key={log.id}>
                  <tr
                    className={`log-row ${expandedConversationId === log.id ? "expanded" : ""}`}
                    onClick={() => toggleConversation(log.id)}
                  >
                    <td className="expand-cell">
                      {expandedConversationId === log.id ? (
                        <FiChevronDown />
                      ) : (
                        <FiChevronRight />
                      )}
                    </td>
                    <td>
                      <strong>{log.title}</strong>
                    </td>
                    <td>{log.username}</td>
                    <td>{formatDateTime(log.startTime)}</td>
                    <td>{log.messageCount}</td>
                    <td>{log.totalTokens}</td>
                    <td>
                      <span className={`status-badge ${log.status}`}>
                        {log.status === "success" ? "Thành công" : "Lỗi"}
                      </span>
                    </td>
                  </tr>

                  {expandedConversationId === log.id && (
                    <tr className="log-detail-row">
                      <td colSpan="7">
                        <div className="conversation-detail">
                          <h3
                            style={{
                              margin: "0 0 16px 0",
                              color: "#1e293b",
                              fontSize: "14px",
                              fontWeight: "600",
                            }}
                          >
                            💬 {log.title}
                          </h3>
                          <div className="conversation-messages">
                            {log.messages.map((message) => (
                              <div
                                key={message.id}
                                className={`conversation-message ${message.sender}`}
                              >
                                <div
                                  className="message-header"
                                  style={{
                                    fontSize: "12px",
                                    marginBottom: "6px",
                                    opacity: 0.8,
                                  }}
                                >
                                  <span className="message-sender">
                                    {message.sender === "user"
                                      ? "👤 Người dùng"
                                      : "🤖 Chatbot"}
                                  </span>
                                  <span
                                    className="message-time"
                                    style={{ marginLeft: "12px" }}
                                  >
                                    {formatDateTime(message.timestamp)}
                                  </span>
                                  {message.sender === "bot" && (
                                    <span
                                      className="message-tokens"
                                      style={{ marginLeft: "12px" }}
                                    >
                                      {message.tokens} tokens
                                    </span>
                                  )}
                                </div>
                                <div
                                  className="message-content"
                                  style={{ lineHeight: "1.5" }}
                                >
                                  {message.content}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="no-results">
                  Không tìm thấy kết quả phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ConversationLogs;
