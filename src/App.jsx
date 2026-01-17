import React, { useState } from 'react';

import { 
  Wand2, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Terminal 
} from 'lucide-react';

// --- 設定區 ---
const FIXED_API_KEY = "AIzaSyARQlNaq5jzChL95NStRGbugaY4hhHEy0A"; 

export default function RealEstateContentApp() {
  const [apiKey, setApiKey] = useState(FIXED_API_KEY);
  const [logs, setLogs] = useState([]);
  const [availableModels, setAvailableModels] = useState(null);
  const [loading, setLoading] = useState(false);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev]);
  };

  // 診斷功能：列出所有可用模型
  const checkConnection = async () => {
    setLoading(true);
    setLogs([]);
    addLog("開始診斷連線...", "info");
    addLog(`使用 API Key: ${apiKey.substring(0, 8)}...`, "info");

    try {
      // 1. 測試連線並取得模型列表
      addLog("正在向 Google 查詢可用模型列表...", "info");
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`連線失敗 (Status: ${response.status}) - ${errorBody}`);
      }

      const data = await response.json();
      addLog("連線成功！取得模型列表。", "success");
      
      if (data.models) {
        // 過濾出 generateContent 支援的模型
        const contentModels = data.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
        setAvailableModels(contentModels);
        addLog(`共找到 ${contentModels.length} 個可用模型。`, "success");
      } else {
        addLog("警告：回傳資料中沒有找到 models 欄位。", "warning");
      }

    } catch (err) {
      console.error(err);
      addLog(`❌ 錯誤: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // 測試特定模型生成
  const testGeneration = async (modelName) => {
    setLoading(true);
    addLog(`正在測試模型: ${modelName} ...`, "info");
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelName}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Hello, 這是測試連線。" }] }]
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (text) {
        addLog(`✅ ${modelName} 測試成功！回應: ${text}`, "success");
      } else {
        addLog(`⚠️ ${modelName} 回應為空`, "warning");
      }

    } catch (e) {
      addLog(`❌ ${modelName} 測試失敗: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <Settings className="w-8 h-8 text-blue-600" />
            API 連線診斷工具
          </h1>
          <p className="text-slate-500">用來檢查為什麼一直出現 404 錯誤</p>
        </div>

        {/* 控制台 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex gap-4 mb-4">
            <input 
              type="text" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 p-2 border rounded"
              placeholder="API Key"
            />
            <button 
              onClick={checkConnection}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-slate-400"
            >
              {loading ? '診斷中...' : '開始診斷'}
            </button>
          </div>

          {/* 錯誤日誌區 */}
          <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm h-64 overflow-y-auto mb-6">
            {logs.length === 0 ? <span className="text-slate-500">// 等待執行指令...</span> : logs.map((log, i) => (
              <div key={i} className={`mb-1 ${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-yellow-300' : ''}`}>
                {log}
              </div>
            ))}
          </div>

          {/* 可用模型列表 */}
          {availableModels && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg border-b pb-2">您的 API Key 支援以下模型：</h3>
              <div className="grid gap-2">
                {availableModels.map((m) => (
                  <div key={m.name} className="flex items-center justify-between p-3 bg-slate-50 rounded border hover:bg-blue-50">
                    <div>
                      <div className="font-bold text-blue-800">{m.name.replace('models/', '')}</div>
                      <div className="text-xs text-slate-500">{m.displayName}</div>
                    </div>
                    <button 
                      onClick={() => testGeneration(m.name)}
                      className="px-3 py-1 text-xs bg-white border border-slate-300 rounded hover:bg-slate-100"
                    >
                      測試生成
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}