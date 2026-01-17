'use client';

import { useState, useEffect } from 'react';

interface ModelConfig {
  endpoint?: string;
  apiKey?: string;
  deploymentName: string;
  apiVersion?: string;
  modelType?: 'chat' | 'codex';
}

interface ConfigData {
  default?: {
    endpoint: string;
    apiKey: string;
    apiVersion?: string;
  };
  models?: {
    [key: string]: ModelConfig;
  };
}

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingModel, setEditingModel] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');

  // 加载配置
  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        console.log('Loaded config:', data);
        // 确保配置结构正确
        const normalizedData: ConfigData = {
          default: data.default || {
            endpoint: '',
            apiKey: '',
            apiVersion: '2024-02-15-preview',
          },
          models: data.models || {},
        };
        setConfig(normalizedData);
      } else {
        const errorText = await response.text();
        throw new Error(`Failed to load config: ${errorText}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载配置失败';
      setMessage({ type: 'error', text: errorMessage });
      console.error('Error loading config:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // 保存配置
  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      console.log('Saving config:', config);
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Config saved:', result);
        setMessage({ type: 'success', text: '配置保存成功' });
        setTimeout(() => setMessage(null), 3000);
        // 保存成功后重新加载配置，确保数据同步
        // 等待一小段时间确保文件写入完成
        await new Promise(resolve => setTimeout(resolve, 100));
        await loadConfig();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save config');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存配置失败';
      setMessage({ type: 'error', text: errorMessage });
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  // 更新默认配置
  const updateDefault = (field: string, value: string) => {
    if (!config) return;
    setConfig({
      ...config,
      default: {
        ...config.default,
        [field]: value,
      } as any,
    });
  };

  // 更新模型配置
  const updateModel = (modelName: string, field: string, value: string) => {
    if (!config || !config.models) return;
    setConfig({
      ...config,
      models: {
        ...config.models,
        [modelName]: {
          ...config.models[modelName],
          [field]: value,
        },
      },
    });
  };

  // 删除模型
  const deleteModel = (modelName: string) => {
    if (!config || !config.models) return;
    const newModels = { ...config.models };
    delete newModels[modelName];
    setConfig({
      ...config,
      models: newModels,
    });
  };

  // 添加模型
  const addModel = () => {
    if (!newModelName.trim() || !config) return;
    const modelName = newModelName.trim();
    
    // 检查模型是否已存在
    if (config.models?.[modelName]) {
      setMessage({ type: 'error', text: `模型 "${modelName}" 已存在` });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    console.log('Adding model:', modelName);
    setConfig({
      ...config,
      models: {
        ...(config.models || {}),
        [modelName]: {
          deploymentName: modelName,
        },
      },
    });
    setNewModelName('');
    setMessage({ type: 'success', text: `模型 "${modelName}" 已添加，请点击"保存配置"按钮保存到文件` });
    setTimeout(() => setMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="text-gray-400 mb-4">无法加载配置</div>
          <button
            onClick={loadConfig}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">模型配置管理</h1>
              <p className="text-sm text-gray-500 mt-1">
                修改配置后请点击"保存配置"按钮以持久化到文件
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadConfig}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              >
                刷新
              </button>
              <button
                onClick={saveConfig}
                disabled={saving || !config}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-semibold"
              >
                {saving ? '保存中...' : '💾 保存配置'}
              </button>
            </div>
          </div>
          {message && (
            <div
              className={`mt-4 px-4 py-3 rounded-lg ${
                message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        {/* Default Config */}
        {config && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">默认配置</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Endpoint
                </label>
                <input
                  type="text"
                  value={config.default?.endpoint || ''}
                  onChange={(e) => updateDefault('endpoint', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://your-resource.openai.azure.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={config.default?.apiKey || ''}
                  onChange={(e) => updateDefault('apiKey', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your-api-key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Version
                </label>
                <input
                  type="text"
                  value={config.default?.apiVersion || ''}
                  onChange={(e) => updateDefault('apiVersion', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="2024-02-15-preview"
                />
              </div>
            </div>
          </div>
        )}

        {/* Models */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">模型配置</h2>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newModelName}
                onChange={(e) => setNewModelName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') addModel();
                }}
                placeholder="新模型名称"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={addModel}
                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
              >
                添加模型
              </button>
            </div>
          </div>

          {config && config.models && Object.keys(config.models).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(config.models).map(([modelName, modelConfig]) => (
                <div
                  key={modelName}
                  className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{modelName}</h3>
                    <button
                      onClick={() => deleteModel(modelName)}
                      className="px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition"
                    >
                      删除
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deployment Name *
                      </label>
                      <input
                        type="text"
                        value={modelConfig.deploymentName || ''}
                        onChange={(e) => updateModel(modelName, 'deploymentName', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Model Type (可选)
                      </label>
                      <select
                        value={modelConfig.modelType || (modelName.toLowerCase().includes('codex') ? 'codex' : 'chat')}
                        onChange={(e) => updateModel(modelName, 'modelType', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="chat">Chat (/chat/completions)</option>
                        <option value="codex">Codex (/completions)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Codex 模型不支持 chat completions
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Endpoint (可选，覆盖默认)
                      </label>
                      <input
                        type="text"
                        value={modelConfig.endpoint || ''}
                        onChange={(e) => updateModel(modelName, 'endpoint', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="留空使用默认"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Key (可选，覆盖默认)
                      </label>
                      <input
                        type="password"
                        value={modelConfig.apiKey || ''}
                        onChange={(e) => updateModel(modelName, 'apiKey', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="留空使用默认"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        API Version (可选，覆盖默认)
                      </label>
                      <input
                        type="text"
                        value={modelConfig.apiVersion || ''}
                        onChange={(e) => updateModel(modelName, 'apiVersion', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="留空使用默认"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              暂无模型配置，点击"添加模型"添加
            </div>
          )}
        </div>
      </div>
    </div>
  );
}