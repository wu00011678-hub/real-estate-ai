import React, { useState } from 'react';
// 注意：在預覽環境中暫時註解此行以避免錯誤。
// 在本機 VS Code 執行時，請取消註解以載入 Tailwind 樣式。
// import './index.css'; 
import { 
  Wand2, 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Terminal,
  Star,
  Zap,
  Crown
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

  // 輔助函式：分析模型優劣與標籤
  const analyzeModel = (modelName) => {
    let score = 0;
    const tags = [];
    const name = modelName.toLowerCase();

    // 1. 版本判斷
    if (name.includes('1.5')) {
      score += 100;
      tags.push({ text: '1.5代 (最新)', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: <Star className="w-3 h-3" /> });
    } else if (name.includes('1.0')) {
      score += 50;
      tags.push({ text: '1.0代 (舊版)', color: 'bg-gray-100 text-gray-600 border-gray-200' });
    }

    // 2. 等級判斷
    if (name.includes('pro')) {
      score += 20;
      tags.push({ text: '旗艦版 (Pro)', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: <Crown className="w-3 h-3" /> });
    } else if (name.includes('flash')) {
      score += 15;
      tags.push({ text: '輕量版 (Flash)', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: <Zap className="w-3 h-3" /> });
    }

    // 3. 修訂版本判斷
    if (name.includes('002')) {
      score += 5;
      tags.push({ text: 'v002 (最新修訂)', color: 'bg-green-100 text-green-800 border-green-200' });
    } else if (name.includes('001')) {
      score += 1;
    } else if (name.includes('latest')) {
      score += 2;
      tags.push({ text: '自動指向最新', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' });
    }

    return { score, tags };
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
        let contentModels = data.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
        
        // 排序：分數高的排前面
        contentModels = contentModels.sort((a, b) => {
          return analyzeModel(b.name).score - analyzeModel(a.name).score;
        });

        setAvailableModels(contentModels);
        addLog(`共找到 ${contentModels.length} 個可用模型 (已依推薦程度排序)。`, "success");
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
            API 模型智能診斷工具
          </h1>
          <p className="text-slate-500">自動分析您的 API Key 權限並推薦最佳模型</p>
        </div>

        {/* 控制台 */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex gap-4 mb-4">
            <input 
              type="text" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 p-2 border rounded"
              placeholder="請輸入您的 Google AI Studio API Key"
            />
            <button 
              onClick={checkConnection}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-slate-400 font-bold shadow-sm transition-all active:scale-95"
            >
              {loading ? '診斷中...' : '開始診斷'}
            </button>
          </div>

          {/* 錯誤日誌區 */}
          <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm h-48 overflow-y-auto mb-6 shadow-inner">
            {logs.length === 0 ? <span className="text-slate-500">// 請點擊「開始診斷」以取得模型列表...</span> : logs.map((log, i) => (
              <div key={i} className={`mb-1 ${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-yellow-300' : ''}`}>
                {log}
              </div>
            ))}
          </div>

          {/* 可用模型列表 */}
          {availableModels && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-bold text-lg text-slate-800">您的 API Key 支援以下模型：</h3>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">已依推薦程度排序</span>
              </div>
              
              <div className="grid gap-3">
                {availableModels.map((m) => {
                  const { tags } = analyzeModel(m.name);
                  const cleanName = m.name.replace('models/', '');
                  
                  return (
                    <div key={m.name} className="group flex flex-col md:flex-row md:items-center justify-between p-4 bg-white rounded-lg border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all">
                      <div className="mb-3 md:mb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-bold text-lg text-slate-800">{cleanName}</div>
                          {/* 顯示標籤 */}
                          {tags.map((tag, i) => (
                            <span key={i} className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${tag.color}`}>
                              {tag.icon}
                              {tag.text}
                            </span>
                          ))}
                        </div>
                        <div className="text-xs text-slate-500 line-clamp-1">{m.description || m.displayName}</div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-right mr-2 hidden md:block">
                          <span className="block text-slate-400">輸入上限</span>
                          <span className="font-mono font-bold text-slate-600">{m.inputTokenLimit?.toLocaleString() || '?'}</span>
                        </div>
                        <button 
                          onClick={() => testGeneration(m.name.replace('models/', ''))}
                          className="px-4 py-2 text-sm bg-slate-50 text-slate-600 border border-slate-300 rounded hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors"
                        >
                          測試生成
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}