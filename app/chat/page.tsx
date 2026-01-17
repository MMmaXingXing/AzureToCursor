'use client';

import { useState, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ModelInfo {
  id: string;
  name: string;
  type: 'chat' | 'codex';
}

export default function ChatTestPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gpt-4');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfo[]>([]);
  
  // 检查当前模型是否是 codex 类型
  const isCodexModel = modelInfo.find(m => m.id === model)?.type === 'codex';

  // 加载模型列表和信息
  const loadModels = async () => {
    try {
      // 加载模型列表
      const response = await fetch('/api/v1/models');
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        const modelIds = data.data.map((m: any) => m.id);
        setAvailableModels(modelIds);
        if (modelIds.length > 0 && !modelIds.includes(model)) {
          setModel(modelIds[0]);
        }
      }
      
      // 加载模型详细信息（包括类型）
      const infoResponse = await fetch('/api/models/info');
      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        if (infoData.models && Array.isArray(infoData.models)) {
          setModelInfo(infoData.models);
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  // 页面加载时获取模型列表
  useEffect(() => {
    loadModels();
  }, []);

  const sendMessage = async (useStream: boolean = false) => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStreaming(useStream);

    try {
      const response = await fetch('/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [...messages, userMessage],
          stream: useStream,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Request failed');
      }

      if (useStream && response.body) {
        // 流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = { role: 'assistant' as const, content: '' };

        setMessages((prev) => [...prev, assistantMessage]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;

              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  assistantMessage.content += delta;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = {
                      ...assistantMessage,
                    };
                    return newMessages;
                  });
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      } else {
        // 非流式响应
        const data = await response.json();
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.choices?.[0]?.message?.content || 'No response',
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">聊天测试</h1>
            {isCodexModel && (
              <p className="text-sm text-orange-600 mt-1">
                ℹ️ Codex 模型：输入将转换为 prompt 格式（messages → prompt）
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              {availableModels.length > 0 ? (
                availableModels.map((m) => {
                  const modelType = modelInfo.find(info => info.id === m)?.type;
                  const label = modelType === 'codex' ? `${m} (Codex)` : m;
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })
              ) : (
                <option value={model}>{model}</option>
              )}
            </select>
            <button
              onClick={clearChat}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
              disabled={loading}
            >
              清空对话
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <p className="text-lg mb-2">开始聊天</p>
              <p className="text-sm">选择模型后输入消息开始对话</p>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-3xl px-4 py-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white border border-gray-200 text-gray-900'
                }`}
              >
                <div className="text-sm font-semibold mb-1">
                  {message.role === 'user' ? 'You' : 'Assistant'}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))
        )}
        {loading && !streaming && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(false);
              }
            }}
            placeholder={isCodexModel ? "输入 prompt（Codex 模型会自动转换）..." : "输入消息..."}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={() => sendMessage(false)}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            发送
          </button>
          <button
            onClick={() => sendMessage(true)}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
          >
            流式
          </button>
        </div>
      </div>
    </div>
  );
}