import React, { useCallback, useEffect, useRef, useState } from "react";
import { FiChevronDown, FiCheck, FiCpu, FiZap } from "react-icons/fi";
import modelService from "../services/modelService";
import "./ModelSelector.css";

const ModelSelector = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [models, setModels] = useState([]);
  const [activeModel, setActiveModel] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  const normalizeModel = useCallback((model) => {
    if (!model || typeof model !== "object") return null;
    return {
      ...model,
      id: model.id || model._id || model.modelId || model.name,
      name: model.name || model.model_name || "Unknown model",
      modelType:
        model.modelType || model.model_type || model.provider || "other",
      description: model.description || "",
      isActive: Boolean(model.isActive),
    };
  }, []);

  const mapAdminAvailableModels = useCallback(
    (raw) => {
      const payload = raw?.data || raw || {};
      const out = [];
      if (Array.isArray(payload?.ollama_models)) {
        payload.ollama_models.forEach((m) => {
          out.push(
            normalizeModel({
              id: m.id || m.name,
              name: m.name,
              modelType: "ollama",
              description:
                `${m?.details?.family || "Ollama"}${m?.details?.parameter_size ? ` - ${m.details.parameter_size}` : ""}`.trim(),
            }),
          );
        });
      }
      if (Array.isArray(payload?.gemini_models)) {
        payload.gemini_models.forEach((m) => {
          out.push(
            normalizeModel({
              id: m.id || m.name,
              name: m.name,
              modelType: "gemini",
              description: m.description || m.display_name || m.name,
            }),
          );
        });
      }
      return out.filter(Boolean);
    },
    [normalizeModel],
  );

  const mapAdminCurrentModel = useCallback(
    (raw) => {
      const payload = raw?.data || raw || {};
      const current = payload?.current_active || payload || null;
      if (!current || !current.model_name) return null;
      return normalizeModel({
        id: current.id || current.model_name,
        name: current.model_name,
        modelType: current.model_type,
        description: `${current.model_type || "model"} model`,
        isActive: true,
      });
    },
    [normalizeModel],
  );

  const loadModelData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allModels, currentActive] = await Promise.allSettled([
        modelService.getAllModels(),
        modelService.getActiveModel(),
      ]);

      let normalizedModels = (
        allModels.status === "fulfilled" && Array.isArray(allModels.value)
          ? allModels.value
          : []
      )
        .map(normalizeModel)
        .filter(Boolean);
      let normalizedActive =
        currentActive.status === "fulfilled"
          ? normalizeModel(currentActive.value)
          : null;

      // Fallback: use admin model APIs if public model APIs return empty
      if (normalizedModels.length === 0) {
        try {
          const adminAvailable = await modelService.getAvailableModels();
          normalizedModels = mapAdminAvailableModels(adminAvailable);
        } catch {
          // ignore fallback error
        }
      }

      if (!normalizedActive) {
        try {
          const adminCurrent = await modelService.getCurrentModel();
          normalizedActive = mapAdminCurrentModel(adminCurrent);
        } catch {
          // ignore fallback error
        }
      }

      setModels(normalizedModels);
      setActiveModel(normalizedActive);
    } catch (e) {
      console.log("Could not fetch models:", e.message);
      setModels([]);
      setActiveModel(null);
    } finally {
      setIsLoading(false);
    }
  }, [normalizeModel, mapAdminAvailableModels, mapAdminCurrentModel]);

  useEffect(() => {
    loadModelData();
  }, [loadModelData]);

  useEffect(() => {
    if (isOpen) {
      loadModelData();
    }
  }, [isOpen, loadModelData]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getModelIcon = (model) => {
    const type = (model?.modelType || "").toLowerCase();
    const name = (model?.name || "").toLowerCase();
    if (type === "gemini" || name.includes("gemini")) return "✦";
    if (type === "ollama" || name.includes("llama") || name.includes("ollama"))
      return "🦙";
    if (name.includes("gpt") || name.includes("openai")) return "◆";
    if (name.includes("claude")) return "◈";
    if (type === "huggingface") return "🤗";
    return "⬡";
  };

  const getModelTypeBadge = (model) => {
    const type = (model?.modelType || "").toUpperCase();
    if (type === "GEMINI") return "Gemini";
    if (type === "OLLAMA") return "Ollama";
    if (type === "HUGGINGFACE") return "HF";
    return type || null;
  };

  const displayName = activeModel?.name || "ACTVN AI";
  const modelCount = models.length;
  const typeBadge = getModelTypeBadge(activeModel);
  const sortedModels = [...models].sort((a, b) => {
    const aActive =
      activeModel && (a.id === activeModel.id || a.name === activeModel.name);
    const bActive =
      activeModel && (b.id === activeModel.id || b.name === activeModel.name);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return (a.name || "").localeCompare(b.name || "", "vi");
  });

  return (
    <div className="model-selector" ref={dropdownRef}>
      <button
        className="model-selector-trigger readonly"
        id="model-selector-btn"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
      >
        <span className="model-selector-icon">{getModelIcon(activeModel)}</span>
        <span className="model-selector-name">{displayName}</span>
        {typeBadge && (
          <span className="model-item-badge compact">{typeBadge}</span>
        )}
        <span className="model-selector-meta">
          {isLoading ? (
            <>
              <FiCpu size={12} />
              Đang tải
            </>
          ) : (
            <>
              <FiZap size={12} />
              {modelCount} model
            </>
          )}
        </span>
        <FiChevronDown
          className={`model-selector-chevron ${isOpen ? "open" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="model-selector-dropdown">
          <div className="model-dropdown-header">
            <span>Danh sách Model (chỉ xem)</span>
          </div>
          <div className="model-dropdown-list">
            {isLoading ? (
              <div className="model-dropdown-empty">
                <FiCpu size={20} />
                <span>Đang tải danh sách model...</span>
              </div>
            ) : sortedModels.length === 0 ? (
              <div className="model-dropdown-empty">
                <FiCpu size={20} />
                <span>Không có model nào</span>
              </div>
            ) : (
              sortedModels.map((model) => {
                const isActive =
                  activeModel &&
                  (model.id === activeModel.id ||
                    model.name === activeModel.name);
                const badge = getModelTypeBadge(model);
                return (
                  <div
                    key={model.id || model.name}
                    className={`model-dropdown-item readonly-item ${isActive ? "active" : ""}`}
                  >
                    <span className="model-item-icon">
                      {getModelIcon(model)}
                    </span>
                    <div className="model-item-info">
                      <span className="model-item-name">{model.name}</span>
                      {model.description && (
                        <span className="model-item-desc">
                          {model.description}
                        </span>
                      )}
                    </div>
                    {badge && <span className="model-item-badge">{badge}</span>}
                    {isActive && <FiCheck className="model-item-check" />}
                  </div>
                );
              })
            )}
          </div>
          {activeModel && (
            <div className="model-dropdown-footer">
              <FiZap size={12} />
              <span>
                Đang hoạt động: <strong>{activeModel.name}</strong>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
