import React, { useState, useEffect, useRef, useCallback } from "react";
import "./LandingPage.css";

// ============================================================
// SVG Icon Components
// ============================================================
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>
);

const IconGraduation = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/>
  </svg>
);

const IconBrain = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A6.5 6.5 0 0 0 3 8.5c0 2.5 1.5 4.6 3.5 5.6V18a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-3.9c2-1 3.5-3.1 3.5-5.6A6.5 6.5 0 0 0 14.5 2"/>
    <path d="M10 22v-3M14 22v-3M12 2v5"/>
    <circle cx="9" cy="10" r="1" fill="currentColor"/>
    <circle cx="15" cy="10" r="1" fill="currentColor"/>
  </svg>
);

const IconDatabase = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
  </svg>
);

const IconZap = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);

const IconTerminal = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 17 10 11 4 5"/>
    <line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);

const IconMessageCircle = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
);

const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="17" height="17">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const IconBot = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
    <path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.07A7 7 0 0 1 14 22h-4a7 7 0 0 1-6.93-3H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM9.5 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm5 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z"/>
  </svg>
);

const IconMenu = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="8" x2="20" y2="8"/>
    <line x1="4" y1="16" x2="20" y2="16"/>
  </svg>
);

const IconX = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const IconBookOpen = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

// ============================================================
// Animated Particles Component
// ============================================================
const ParticlesCanvas = () => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const particlesRef = useRef([]);

  const initParticles = useCallback((width, height) => {
    const count = Math.min(Math.floor((width * height) / 18000), 80);
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: Math.random() * 2 + 1,
        opacity: Math.random() * 0.3 + 0.05,
        hue: Math.random() > 0.5 ? 330 : 260, // pink or purple
      });
    }
    return particles;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = document.documentElement.scrollHeight;
      particlesRef.current = initParticles(canvas.width, canvas.height);
    };

    resize();
    window.addEventListener("resize", resize);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 70%, 60%, ${p.opacity})`;
        ctx.fill();
      });

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(194, 24, 91, ${0.04 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [initParticles]);

  return <canvas ref={canvasRef} className="lp-particles-canvas" />;
};

// ============================================================
// Main Landing Page Component
// ============================================================
const LandingPage = ({ onNavigateLogin, onNavigateRegister }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setIsMobileMenuOpen(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Animated Particles Background */}
      <ParticlesCanvas />

      {/* Floating Orbs */}
      <div className="lp-orb lp-orb-1" />
      <div className="lp-orb lp-orb-2" />
      <div className="lp-orb lp-orb-3" />

      {/* ======== HEADER ======== */}
      <header className={`lp-header ${isScrolled ? "scrolled" : ""}`}>
        <nav className="lp-nav lp-container">
          <div className="lp-logo-group">
            <img
              src="/img/kma.png"
              alt="Logo Học viện Kỹ thuật Mật mã"
              className="lp-logo-img"
            />
            <div className="lp-logo-text-block">
              <span className="lp-logo-brand">ACTVN-AGENT</span>
              <span className="lp-logo-tagline">
                AI Chatbot — Học viện Kỹ thuật Mật mã
              </span>
            </div>
          </div>

          <ul className="lp-nav-links">
            <li>
              <a
                href="#gioi-thieu"
                className="active"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("gioi-thieu");
                }}
              >
                Giới thiệu
              </a>
            </li>
            <li>
              <a
                href="#tinh-nang"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("tinh-nang");
                }}
              >
                Tính năng
              </a>
            </li>
            <li>
              <a
                href="#huong-dan"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("huong-dan");
                }}
              >
                Hướng dẫn
              </a>
            </li>
            <li>
              <a
                href="#lien-he"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToSection("lien-he");
                }}
              >
                Liên hệ
              </a>
            </li>
          </ul>

          <div className="lp-nav-actions">
            <button className="lp-btn lp-btn-ghost" onClick={onNavigateLogin}>
              Đăng nhập
            </button>
            <button
              className="lp-btn lp-btn-primary"
              onClick={onNavigateRegister}
            >
              Đăng ký
            </button>
            <button
              className="lp-menu-btn"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <IconX /> : <IconMenu />}
            </button>
          </div>
        </nav>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lp-mobile-menu">
            <a href="#gioi-thieu" onClick={(e) => { e.preventDefault(); scrollToSection("gioi-thieu"); }}>
              Giới thiệu
            </a>
            <a href="#tinh-nang" onClick={(e) => { e.preventDefault(); scrollToSection("tinh-nang"); }}>
              Tính năng
            </a>
            <a href="#huong-dan" onClick={(e) => { e.preventDefault(); scrollToSection("huong-dan"); }}>
              Hướng dẫn
            </a>
            <a href="#lien-he" onClick={(e) => { e.preventDefault(); scrollToSection("lien-he"); }}>
              Liên hệ
            </a>
            <button className="lp-btn lp-btn-ghost" onClick={() => { setIsMobileMenuOpen(false); onNavigateLogin(); }}>
              Đăng nhập
            </button>
            <button className="lp-btn lp-btn-primary" onClick={() => { setIsMobileMenuOpen(false); onNavigateRegister(); }}>
              Đăng ký tài khoản
            </button>
          </div>
        )}
      </header>

      {/* ======== HERO ======== */}
      <section className="lp-hero" id="gioi-thieu">
        <div className="lp-hero-bg" />
        <div className="lp-hero-mesh" />
        <div className="lp-container">
          <div className="lp-hero-grid">
            {/* Left Content */}
            <div className="lp-hero-content">
              <div className="lp-badge lp-fade-up">
                <span className="lp-badge-dot" />
                <span className="lp-badge-text">
                  AI Chatbot — Học viện Kỹ thuật Mật mã
                </span>
              </div>

              <h1 className="lp-hero-title lp-fade-up lp-fade-up-d1">
                Trợ lý ảo thông minh{" "}
                <span className="highlight">
                  dành riêng cho sinh viên Học viện Kỹ thuật Mật mã
                </span>
              </h1>

              <p className="lp-hero-desc lp-fade-up lp-fade-up-d2">
                Trải nghiệm chatbot AI thế hệ mới, được huấn luyện trên dữ
                liệu chính thống của Học viện Kỹ thuật Mật mã. Hỗ trợ tra cứu
                thông tin, giải đáp thắc mắc về học tập, quy chế và chương
                trình đào tạo — nhanh chóng, chính xác và bảo mật.
              </p>

              <div className="lp-hero-actions lp-fade-up lp-fade-up-d3">
                <button
                  className="lp-btn lp-btn-primary lp-btn-lg"
                  onClick={onNavigateLogin}
                >
                  <IconMessageCircle />
                  Bắt đầu trò chuyện
                </button>
                <button
                  className="lp-btn lp-btn-outline lp-btn-lg"
                  onClick={() => scrollToSection("tinh-nang")}
                >
                  Tìm hiểu thêm
                  <IconArrowRight />
                </button>
              </div>

              <div className="lp-hero-stats lp-fade-up lp-fade-up-d4">
                <div className="lp-avatar-stack">
                  <img src="https://i.pravatar.cc/80?img=12" alt="Sinh viên" />
                  <img src="https://i.pravatar.cc/80?img=32" alt="Sinh viên" />
                  <img src="https://i.pravatar.cc/80?img=47" alt="Sinh viên" />
                </div>
                <p className="lp-stat-text">
                  Hơn <strong>5.000+</strong> sinh viên đã tin dùng
                </p>
              </div>
            </div>

            {/* Right — Chat Preview */}
            <div className="lp-chat-preview lp-fade-up lp-fade-up-d3">
              <div className="lp-chat-glow" />
              <div className="lp-chat-card">
                <div className="lp-chat-header">
                  <div className="lp-chat-avatar">
                    <IconBot />
                  </div>
                  <div>
                    <p className="lp-chat-name">ACTVN-AGENT</p>
                    <p className="lp-chat-status">
                      <span className="lp-chat-status-dot" />
                      Trực tuyến
                    </p>
                  </div>
                </div>

                <div className="lp-chat-messages">
                  <div className="lp-msg lp-msg-bot">
                    Xin chào! Mình là trợ lý ảo của Học viện Kỹ thuật Mật mã.
                    Mình có thể giúp gì cho bạn hôm nay?
                  </div>
                  <div className="lp-msg lp-msg-user">
                    Cho mình hỏi lịch thi học kỳ 2 khi nào bắt đầu?
                  </div>
                  <div className="lp-msg lp-msg-bot">
                    Theo thông báo mới nhất của Phòng Đào tạo, lịch thi học kỳ
                    2 năm học 2025–2026 sẽ bắt đầu từ ngày 15/06/2026. Bạn có
                    thể xem chi tiết trên cổng sinh viên.
                  </div>
                  <div className="lp-typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>

                <div className="lp-chat-input-row">
                  <div className="lp-chat-input-placeholder">
                    Nhập câu hỏi của bạn...
                  </div>
                  <button className="lp-chat-send-btn" aria-label="Gửi">
                    <IconSend />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======== FEATURES ======== */}
      <section className="lp-features" id="tinh-nang">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-tag">Tính năng nổi bật</span>
            <h2 className="lp-section-title">
              Tại sao nên sử dụng ACTVN-AGENT?
            </h2>
            <p className="lp-section-desc">
              Được xây dựng chuyên biệt cho Học viện Kỹ thuật Mật mã, đáp ứng
              các tiêu chuẩn khắt khe về độ chính xác, bảo mật và trải nghiệm
              người dùng.
            </p>
          </div>

          <div className="lp-features-grid">
            <div className="lp-feature-card">
              <div className="lp-feature-icon">
                <IconShield />
              </div>
              <h3>Bảo mật tuyệt đối</h3>
              <p>
                Dữ liệu được mã hóa đầu cuối, đảm bảo thông tin cá nhân và nội
                dung trò chuyện luôn an toàn, tuân thủ các quy chuẩn bảo mật
                của Học viện Kỹ thuật Mật mã.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon">
                <IconGraduation />
              </div>
              <h3>Hỗ trợ học tập 24/7</h3>
              <p>
                Giải đáp mọi thắc mắc về chương trình đào tạo, quy chế học vụ,
                lịch thi, học phí và các thông tin quan trọng khác — bất kỳ lúc
                nào bạn cần.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon">
                <IconCheck />
              </div>
              <h3>Dữ liệu chính xác</h3>
              <p>
                Được huấn luyện trên nguồn tài liệu chính thống — giáo trình,
                quy định, thông báo — đảm bảo câu trả lời đáng tin cậy và cập
                nhật.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon">
                <IconBrain />
              </div>
              <h3>Trí tuệ nhân tạo tiên tiến</h3>
              <p>
                Ứng dụng công nghệ AI thế hệ mới kết hợp mô hình ngôn ngữ lớn
                (LLM) và kỹ thuật RAG, mang lại câu trả lời tự nhiên, chính
                xác theo ngữ cảnh.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon">
                <IconBookOpen />
              </div>
              <h3>Kho tri thức phong phú</h3>
              <p>
                Tích hợp hàng triệu tài liệu từ các phòng ban, khoa, bộ môn —
                từ thông tin đào tạo đến nội dung chuyên ngành mật mã và an toàn
                thông tin.
              </p>
            </div>

            <div className="lp-feature-card">
              <div className="lp-feature-icon">
                <IconZap />
              </div>
              <h3>Phản hồi siêu nhanh</h3>
              <p>
                Tốc độ phản hồi trung bình dưới 1 giây, giúp bạn tiết kiệm thời
                gian tìm kiếm thông tin và tập trung vào việc học tập, nghiên cứu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======== STATS BENTO ======== */}
      <section className="lp-stats">
        <div className="lp-container">
          <div className="lp-bento-grid">
            {/* Hero cell */}
            <div className="lp-bento-hero">
              <div className="lp-bento-hero-glow" />
              <div className="lp-bento-hero-glow-2" />
              {/* Animated dots */}
              <div className="lp-bento-dots">
                <span /><span /><span /><span /><span /><span />
              </div>
              <div style={{ position: "relative", zIndex: 1 }}>
                <p className="lp-bento-hero-label">
                  Trợ lý ảo Học viện Kỹ thuật Mật mã
                </p>
                <h3 className="lp-bento-hero-title">
                  Hệ sinh thái AI
                  <br />
                  toàn diện cho sinh viên
                </h3>
              </div>
              <div className="lp-bento-hero-stat" style={{ position: "relative", zIndex: 1 }}>
                <span className="lp-bento-hero-num">98%</span>
                <span className="lp-bento-hero-unit">
                  mức độ hài lòng
                  <br />
                  của người dùng
                </span>
              </div>
            </div>

            {/* Cell A */}
            <div className="lp-bento-cell lp-bento-cell-a">
              <IconZap />
              <div>
                <p className="lp-bento-cell-value">&lt; 1s</p>
                <p className="lp-bento-cell-label">Tốc độ phản hồi</p>
              </div>
            </div>

            {/* Cell B */}
            <div className="lp-bento-cell lp-bento-cell-b">
              <IconDatabase />
              <div>
                <p className="lp-bento-cell-value">1M+</p>
                <p className="lp-bento-cell-label">Tài liệu học tập</p>
              </div>
            </div>

            {/* Wide cell */}
            <div className="lp-bento-cell lp-bento-wide">
              <div className="lp-bento-wide-icon">
                <IconTerminal />
              </div>
              <div>
                <h4>Đa dạng chủ đề hỗ trợ</h4>
                <p>
                  Từ thông tin tuyển sinh, chương trình đào tạo, quy chế thi cử
                  đến kiến thức chuyên ngành mật mã, an toàn thông tin.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======== HOW IT WORKS ======== */}
      <section className="lp-howto" id="huong-dan">
        <div className="lp-container">
          <div className="lp-section-header">
            <span className="lp-section-tag">Hướng dẫn sử dụng</span>
            <h2 className="lp-section-title">
              Bắt đầu sử dụng thật dễ dàng
            </h2>
            <p className="lp-section-desc">
              Chỉ cần 4 bước đơn giản, bạn đã có thể trải nghiệm trợ lý ảo AI
              thông minh của Học viện Kỹ thuật Mật mã.
            </p>
          </div>

          <div className="lp-steps-grid">
            <div className="lp-step">
              <div className="lp-step-num">1</div>
              <h4>Đăng ký tài khoản</h4>
              <p>
                Tạo tài khoản miễn phí chỉ trong vài giây với tên đăng nhập,
                email và mật khẩu.
              </p>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">2</div>
              <h4>Đăng nhập hệ thống</h4>
              <p>
                Sử dụng tài khoản vừa đăng ký để truy cập vào hệ thống
                chatbot ACTVN-AGENT.
              </p>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">3</div>
              <h4>Chọn chủ đề</h4>
              <p>
                Lựa chọn phạm vi câu hỏi phù hợp: Phòng Đào tạo, Khảo thí,
                các Khoa hoặc tìm kiếm tự do.
              </p>
            </div>
            <div className="lp-step">
              <div className="lp-step-num">4</div>
              <h4>Bắt đầu hỏi đáp</h4>
              <p>
                Nhập câu hỏi và nhận câu trả lời chính xác từ trợ lý ảo AI
                trong tích tắc.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ======== CTA ======== */}
      <section className="lp-cta">
        <div className="lp-container">
          <div className="lp-cta-card">
            <div className="lp-cta-glow-1" />
            <div className="lp-cta-glow-2" />
            {/* Rising dots */}
            <div className="lp-cta-dots">
              <span /><span /><span /><span />
              <span /><span /><span /><span />
            </div>
            <div className="lp-cta-content">
              <h2 className="lp-cta-title">
                Sẵn sàng khám phá
                <br />
                <span className="highlight">trợ lý ảo ACTVN-AGENT</span>?
              </h2>
              <p className="lp-cta-desc">
                Tham gia cùng hàng nghìn sinh viên Học viện Kỹ thuật Mật mã.
                Hoàn toàn miễn phí — đăng ký ngay để trải nghiệm!
              </p>
              <button
                className="lp-btn lp-btn-white lp-btn-lg"
                onClick={onNavigateRegister}
              >
                Đăng ký ngay bây giờ
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ======== FOOTER ======== */}
      <footer className="lp-footer" id="lien-he">
        <div className="lp-container">
          <div className="lp-footer-inner">
            <div className="lp-footer-logo">
              <img src="/img/kma.png" alt="Logo Học viện Kỹ thuật Mật mã" />
              <div className="lp-footer-logo-text">
                <span className="lp-footer-brand">ACTVN-AGENT</span>
                <span className="lp-footer-tagline">
                  AI Chatbot — Học viện Kỹ thuật Mật mã
                </span>
              </div>
            </div>

            <nav className="lp-footer-nav">
              <a href="#gioi-thieu" onClick={(e) => { e.preventDefault(); scrollToSection("gioi-thieu"); }}>
                Giới thiệu
              </a>
              <a href="#tinh-nang" onClick={(e) => { e.preventDefault(); scrollToSection("tinh-nang"); }}>
                Tính năng
              </a>
              <a href="#huong-dan" onClick={(e) => { e.preventDefault(); scrollToSection("huong-dan"); }}>
                Hướng dẫn sử dụng
              </a>
              <a href="mailto:ductrongbui1213@gmail.com">
                Liên hệ hỗ trợ
              </a>
            </nav>

            <div className="lp-footer-contact">
              <p>
                <strong>Tác giả:</strong> Bùi Đức Trọng
              </p>
              <p>
                <strong>Email:</strong>{" "}
                <a href="mailto:ductrongbui1213@gmail.com">
                  ductrongbui1213@gmail.com
                </a>
              </p>
              <p>
                <strong>Đơn vị:</strong> Học viện Kỹ thuật Mật mã
              </p>
            </div>

            <div className="lp-footer-bottom">
              <p>
                © 2025 Học viện Kỹ thuật Mật mã.
                <br />
                Hệ thống Trí tuệ Nhân tạo hỗ trợ đào tạo — ACTVN-AGENT.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
