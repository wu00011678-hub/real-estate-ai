import React, { useState, useEffect } from 'react';
// 注意：在預覽環境為了避免報錯，我先將下面這行註解起來。
// ★★★ 在您的本機 VS Code，請務必把下面這行的 // 刪掉，樣式才會生效！ ★★★

import { 
  Clapperboard, 
  Facebook, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Wand2, 
  Copy, 
  Check, 
  FileText, 
  Loader2,
  AlertCircle,
  Clock,
  Mic,
  Eye,
  Palette,
  Lightbulb,
  MessageCircle,
  Zap,
  Crown,
  History,
  Sparkles,
  Save // 新增 Save 圖示
} from 'lucide-react';

// --- 設定區 ---
const FIXED_API_KEY = "AIzaSyARQlNaq5jzChL95NStRGbugaY4hhHEy0A"; 

// --- 模型策略設定 (Model Strategy) ---
// 這裡將您最初使用的 2.5 版本放回第一順位
const TEXT_MODELS_PRIORITY = [
  { id: 'gemini-2.5-flash-preview-09-2025', name: '2.5 Flash Preview (初代設定)' },
  { id: 'gemini-2.0-flash-exp', name: '2.0 Flash Exp (最新)' },
  { id: 'gemini-1.5-flash', name: '1.5 Flash (穩定)' },
  { id: 'gemini-1.5-pro', name: '1.5 Pro (旗艦)' }
];

// 視覺部分也優先使用 2.5，因為它讀圖能力很強
const VISION_MODELS_PRIORITY = [
  { id: 'gemini-2.5-flash-preview-09-2025', name: '2.5 Flash Preview (初代設定)' },
  { id: 'gemini-2.0-flash-exp', name: '2.0 Flash Exp (最新)' },
  { id: 'gemini-1.5-flash', name: '1.5 Flash (穩定)' },
  { id: 'gemini-1.5-pro', name: '1.5 Pro (旗艦)' }
];

// --- 輔助工具：延遲函數 ---
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function RealEstateContentApp() {
  // --- 狀態管理 ---
  const [apiKey] = useState(FIXED_API_KEY);
  const [mode, setMode] = useState('text');
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  
  // 設定選項
  const [videoLength, setVideoLength] = useState('60'); 
  const [fbLength, setFbLength] = useState('medium'); 
  
  // 官方帳號 (初始化時嘗試從 LocalStorage 讀取)
  const [officialAccount, setOfficialAccount] = useState(() => {
    // 檢查是否在瀏覽器環境
    if (typeof window !== 'undefined') {
      return localStorage.getItem('real_estate_official_account') || '';
    }
    return '';
  }); 
  const [isSaved, setIsSaved] = useState(false); // 控制儲存按鈕的狀態顯示

  // 生成結果狀態
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('script'); 
  
  // 記錄實際使用的模型
  const [usedModel, setUsedModel] = useState(null);

  // --- 儲存官方帳號功能 ---
  const handleSaveAccount = () => {
    localStorage.setItem('real_estate_official_account', officialAccount);
    setIsSaved(true);
    // 2秒後恢復按鈕狀態
    setTimeout(() => setIsSaved(false), 2000);
  };

  // --- 圖片處理 ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- 核心 AI 邏輯 ---
  const generateContent = async () => {
    if (!apiKey) {
      setError('未檢測到 API Key，請檢查程式碼設定。');
      return;
    }
    if (mode === 'text' && !inputText) {
      setError('請輸入網址或文章內容');
      return;
    }
    if (mode === 'image' && !selectedImage) {
      setError('請上傳圖片');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setUsedModel(null);
    setStatusMessage('正在啟動 AI 引擎...');

    try {
      let baseContent = '';
      let keywords = [];
      let analysisResult = null;
      
      // 步驟 1: 分析內容
      if (mode === 'text') {
        setStatusMessage('正在分析文章內容...');
        analysisResult = await analyzeTextWithGemini(inputText, apiKey);
      } else {
        setStatusMessage('正在辨識圖片內容...');
        analysisResult = await analyzeImageWithGemini(selectedImage, apiKey);
      }

      baseContent = analysisResult.summary || analysisResult.text;
      keywords = analysisResult.keywords;
      setUsedModel(analysisResult.model); 

      // 步驟 2: 依序生成
      setStatusMessage('正在撰寫短影音腳本 (1/2)...');
      await delay(1500); 
      const scriptData = await generateVideoScript(baseContent, keywords, videoLength, apiKey);
      
      setStatusMessage('正在撰寫社群貼文 (2/2)...');
      await delay(2000);
      const fbData = await generateSocialPost(baseContent, keywords, fbLength, officialAccount, apiKey);

      setResult({
        analysis: baseContent,
        keywords: keywords,
        script: scriptData, 
        fbPost: fbData      
      });
      setStatusMessage('生成完成！');
      
    } catch (err) {
      console.error(err);
      const msg = err.message || '未知錯誤';
      if (msg.includes('429')) {
        setError('API 使用量已達上限 (429)，請休息一分鐘後再試。');
      } else if (msg.includes('Safety')) {
        setError('內容被 AI 安全過濾器阻擋，請嘗試修改輸入內容。');
      } else {
        setError(`生成失敗: ${msg}`);
      }
    } finally {
      setLoading(false);
      if (!error) setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  // --- 核心：智慧多重請求函式 (Smart Request) ---
  async function smartGeminiRequest(payload, key, customModels = TEXT_MODELS_PRIORITY) {
    let lastError = null;

    for (const model of customModels) {
      try {
        setStatusMessage(`正在嘗試模型: ${model.name}...`);
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if ([404, 403, 503, 500].includes(response.status)) {
            console.warn(`模型 ${model.id} 失敗 (${response.status})，切換備用模型...`);
            lastError = new Error(`模型 ${model.id} 回傳 ${response.status}`); 
            continue; 
          }
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(`API Error: ${response.status} ${errorBody.error?.message || ''}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error("API 回應為空 (可能被安全阻擋)");

        return { text: String(text), usedModel: model.name };

      } catch (e) {
        lastError = e;
        console.warn(`模型 ${model.id} 執行錯誤:`, e.message);
      }
    }

    throw new Error(`所有模型嘗試皆失敗。請檢查您的 API Key 是否正確。(${lastError?.message})`);
  }

  // --- 1. 分析文字 ---
  async function analyzeTextWithGemini(text, key) {
    const prompt = `
      你是一個專業的房地產分析師。請分析以下內容：
      "${text}"
      任務：擷取重點摘要 (Summary) 與 5-8 個關鍵字 (Keywords)。
      請回傳 JSON：{ "summary": "...", "keywords": ["..."] }
    `;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };
    
    const { text: resultText, usedModel } = await smartGeminiRequest(payload, key, TEXT_MODELS_PRIORITY);
    const parsed = safeJsonParse(resultText);
    return { ...parsed, model: usedModel };
  }

  // --- 2. 分析圖片 ---
  async function analyzeImageWithGemini(file, key) {
    if (!imagePreview) throw new Error("圖片資料尚未準備好");
    const base64Data = imagePreview.split(',')[1];
    
    const promptText = `你是一位專業的房地產文案專家。請先判斷這張圖片的類型，再進行資訊擷取：
    A. 物件銷售：抓取總價、坪數、格局、地點。
    B. 政策/新聞：抓取標題、重點摘要、關鍵日期。
    回傳 JSON：{ "text": "摘要...", "keywords": ["..."] }`;

    const payload = {
      contents: [{
        parts: [
          { text: promptText }, 
          { inline_data: { mime_type: file.type, data: base64Data } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };

    const { text: resultText, usedModel } = await smartGeminiRequest(payload, key, VISION_MODELS_PRIORITY);
    const parsed = safeJsonParse(resultText);
    return { ...parsed, model: usedModel };
  }

  // --- 3. 生成腳本 ---
  async function generateVideoScript(content, keywords, seconds, key) {
    const prompt = `
      房地產短影音腳本(${seconds}秒)。
      資訊：${content}
      關鍵字：${keywords.join(', ')}
      回傳 JSON：{"template_name": "...", "hooks": ["..."], "titles": ["..."], "scenes": [{"time": "...", "visual": "...", "image_prompt": "...", "audio": "..."}], "cta": "..."}
    `;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };
    const { text } = await smartGeminiRequest(payload, key, TEXT_MODELS_PRIORITY);
    return safeJsonParse(text);
  }

  // --- 4. 生成貼文 ---
  async function generateSocialPost(content, keywords, length, account, key) {
    const lengthMap = { short: '短篇', medium: '中篇', long: '長篇' };
    
    // 優化後的 CTA 指令
    let ctaInstruction = "(請自行撰寫吸引人的 CTA)";
    if (account) {
      ctaInstruction = `(請務必在文末 CTA 加入固定文字：「如果你有關於房地產的問題或是想獲取更多資訊，歡迎加入官方帳號: ${account}」)`;
    }

    const prompt = `
      你是一個台灣在地化的房地產社群小編。請根據以下資訊寫一篇 Facebook 貼文。
      
      資訊內容：${content}
      篇幅：${lengthMap[length]}
      官方帳號連結：${account || '無'} ${ctaInstruction}
      
      風格要求：
      1. 接地氣且人性化，製造衝突點 (如買vs租)。
      2. 需包含 Emoji 與 Hashtags。
      3. 重要：如果使用顏文字 (如 ¯\\_(ツ)_/¯ )，請務必將反斜線跳脫 (例如 ¯\\\\_(ツ)_/¯ ) 以符合 JSON 格式。
      
      請嚴格遵守 JSON 格式回傳，結構如下：
      {
        "content": "貼文完整內容 (Markdown 格式)",
        "image_prompt": "適合此貼文的 AI 繪圖提示詞 (英文, 高畫質, 寫實風格, 適合 Gemini Nano 或 Filmora 生成, 描述一個吸引人的場景)"
      }
    `;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json" }
    };
    const { text } = await smartGeminiRequest(payload, key, TEXT_MODELS_PRIORITY);
    return safeJsonParse(text);
  }

  // --- 安全 JSON 解析 ---
  function safeJsonParse(input) {
    try {
      let cleaned = input.replace(/```json/g, '').replace(/```/g, '').trim();
      const s = cleaned.indexOf('{');
      const e = cleaned.lastIndexOf('}');
      if (s !== -1 && e !== -1) cleaned = cleaned.substring(s, e + 1);
      return JSON.parse(cleaned);
    } catch (e) {
      try {
        const fixed = input.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
        return JSON.parse(fixed);
      } catch {
        throw new Error("AI 回傳資料格式損壞");
      }
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <Wand2 className="w-8 h-8 text-indigo-600" />
            房地產AI智能行銷專家
          </h1>
          <p className="text-slate-500">API Key 已就緒 ✨ 多重引擎 (2.5 Preview 優先)</p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
          <div className="flex border-b border-slate-100">
            <button onClick={() => setMode('text')} className={`flex-1 py-4 font-medium flex justify-center gap-2 ${mode === 'text' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}><LinkIcon className="w-5 h-5" /> 文章/網址輸入</button>
            <button onClick={() => setMode('image')} className={`flex-1 py-4 font-medium flex justify-center gap-2 ${mode === 'image' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}><ImageIcon className="w-5 h-5" /> 圖片/傳單辨識</button>
          </div>

          <div className="p-6 space-y-6">
            {mode === 'text' ? (
              <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="請貼上房地產新聞、文章內容..." className="w-full h-32 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none bg-slate-50" />
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative bg-slate-50">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded shadow-sm" />
                ) : (
                  <div className="space-y-2">
                    <ImageIcon className="w-10 h-10 text-slate-400 mx-auto" />
                    <p className="text-slate-500">點擊上傳圖片</p>
                  </div>
                )}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1"><Clapperboard className="w-4 h-4" /> 影片長度</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {['60', '90', '120'].map((len) => (
                    <button key={len} onClick={() => setVideoLength(len)} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${videoLength === len ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{len} 秒</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1"><Facebook className="w-4 h-4" /> 貼文長度</label>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                  {['short', 'medium', 'long'].map((opt) => (
                    <button key={opt} onClick={() => setFbLength(opt)} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${fbLength === opt ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{opt === 'short' ? '短篇' : opt === 'medium' ? '中篇' : '長篇'}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* 優化後的官方帳號區塊：加入儲存按鈕 */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1"><MessageCircle className="w-4 h-4" /> 官方帳號 (自動加入貼文 CTA)</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={officialAccount} 
                  onChange={(e) => setOfficialAccount(e.target.value)} 
                  placeholder="例如：Line ID @house123 或 https://lin.ee/..." 
                  className="flex-1 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50" 
                />
                <button 
                  onClick={handleSaveAccount}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 font-medium shadow-sm border ${isSaved ? 'bg-green-100 text-green-700 border-green-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  title="儲存官方帳號，下次自動帶入"
                >
                  {isSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {isSaved ? '已儲存' : '儲存'}
                </button>
              </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 font-medium border border-red-100"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}

            <button
              onClick={generateContent}
              disabled={loading}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transform transition-all active:scale-[0.99] flex items-center justify-center gap-2 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700'}`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  {statusMessage || '生成中...'}
                </>
              ) : (
                <><Wand2 className="w-6 h-6" /> 立即生成</>
              )}
            </button>
          </div>
        </div>

        {/* Results Section */}
        {result && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* 顯示目前使用的模型 */}
            {usedModel && (
              <div className="bg-green-50 border-b border-green-100 p-2 text-center text-xs text-green-700 font-medium flex items-center justify-center gap-1">
                {usedModel.includes('2.5') ? <Sparkles className="w-3 h-3 text-yellow-500" /> : (usedModel.includes('Pro') ? <Crown className="w-3 h-3" /> : (usedModel.includes('2.0') ? <Zap className="w-3 h-3" /> : <History className="w-3 h-3" />))}
                本次生成使用模型：{usedModel}
              </div>
            )}

            <div className="flex border-b border-slate-100 bg-slate-50/50">
              <TabButton active={activeTab === 'script'} onClick={() => setActiveTab('script')} icon={<Clapperboard className="w-4 h-4" />} label="短影音腳本" />
              <TabButton active={activeTab === 'facebook'} onClick={() => setActiveTab('facebook')} icon={<Facebook className="w-4 h-4" />} label="社群貼文" />
              <TabButton active={activeTab === 'analysis'} onClick={() => setActiveTab('analysis')} icon={<FileText className="w-4 h-4" />} label="原始分析" />
            </div>

            <div className="p-6 bg-slate-50 min-h-[500px]">
              {activeTab === 'script' && <ScriptVisualizer data={result.script} />}
              {activeTab === 'facebook' && <SocialPostVisualizer data={result.fbPost} />}
              {activeTab === 'analysis' && (
                <div className="space-y-4">
                  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm"><h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-yellow-500" /> 關鍵字</h3><div className="flex flex-wrap gap-2">{result.keywords.map((kw, idx) => <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium">#{kw}</span>)}</div></div>
                  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm"><h3 className="font-bold text-slate-800 mb-4">內容摘要</h3><p className="text-slate-600 leading-relaxed">{result.analysis}</p></div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ... 下方的 ScriptVisualizer, SocialPostVisualizer, TabButton 保持不變 ...
// (為節省篇幅，請保留您原本的這些子元件程式碼，或者直接複製上面完整版的最下方)
function ScriptVisualizer({ data }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    let text = `【${data.template_name}】短影音腳本\n\n`;
    text += `🔥 鉤子推薦：\n${data.hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n`;
    text += `📌 標題推薦：\n${data.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`;
    text += `🎬 分鏡腳本：\n`;
    data.scenes.forEach((s) => { text += `[${s.time}] 畫面：${s.visual}\n提示詞：${s.image_prompt}\n口播：${s.audio}\n\n`; });
    text += `📢 CTA：${data.cta}`;
    navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg"><div className="flex items-center gap-2 mb-4 opacity-90"><Lightbulb className="w-5 h-5" /><span className="text-sm font-bold tracking-wider uppercase">Strategy</span></div><h2 className="text-2xl font-bold mb-2">{data.template_name}</h2><p className="text-indigo-100 text-sm">此腳本採用的熱門流量架構</p></div>
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm"><h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Check className="w-5 h-5 text-green-500" /> 爆款標題建議</h3><ul className="space-y-2">{data.titles.map((title, idx) => <li key={idx} className="flex items-start gap-2 text-slate-700 text-sm"><span className="bg-slate-100 text-slate-500 px-1.5 rounded text-xs mt-0.5">{idx+1}</span>{title}</li>)}</ul></div>
      </div>
      <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100"><h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><Eye className="w-5 h-5" /> 黃金 3 秒鉤子 (任選其一)</h3><div className="grid md:grid-cols-3 gap-4">{data.hooks.map((hook, idx) => <div key={idx} className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm text-sm text-slate-700 font-medium">"{hook}"</div>)}</div></div>
      <div className="space-y-4"><div className="flex items-center justify-between"><h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Clapperboard className="w-5 h-5 text-indigo-600" /> 拍攝分鏡表</h3><button onClick={handleCopy} className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors">{copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}{copied ? '已複製' : '複製全部'}</button></div>{data.scenes.map((scene, idx) => (
        <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
          <div className="md:w-24 bg-slate-50 p-4 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-100"><div className="text-center"><Clock className="w-5 h-5 text-slate-400 mx-auto mb-1" /><span className="font-mono font-bold text-slate-600">{scene.time}</span></div></div>
          <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100"><div className="flex items-start gap-2 mb-3"><ImageIcon className="w-4 h-4 text-indigo-500 mt-1 shrink-0" /><p className="text-slate-800 font-medium">{scene.visual}</p></div><div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 border border-slate-100"><div className="flex items-center gap-1 mb-1 text-slate-400 font-semibold uppercase tracking-wider text-[10px]"><Palette className="w-3 h-3" /> AI Image Prompt</div><p className="font-mono leading-relaxed select-all cursor-text hover:text-slate-700 transition-colors">{scene.image_prompt}</p></div></div>
          <div className="flex-1 p-5 bg-yellow-50/30"><div className="flex items-start gap-2"><Mic className="w-4 h-4 text-yellow-600 mt-1 shrink-0" /><p className="text-slate-700 leading-relaxed font-medium">{scene.audio}</p></div></div>
        </div>
      ))}</div>
      <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg flex items-start gap-3"><div className="font-bold text-indigo-800 shrink-0">CTA 行動呼籲：</div><p className="text-indigo-700">{data.cta}</p></div>
    </div>
  );
}

// --- 子元件：社群貼文視覺化 (升級版) ---
function SocialPostVisualizer({ data }) {
  const [copiedContent, setCopiedContent] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  return (
    <div className="grid md:grid-cols-3 gap-6 animate-in fade-in duration-500">
      <div className="md:col-span-2 space-y-4">
        <div className="flex items-center justify-between"><h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Facebook className="w-5 h-5 text-blue-600" /> 貼文內容</h3><button onClick={()=>{navigator.clipboard.writeText(data.content);setCopiedContent(true);setTimeout(()=>setCopiedContent(false),2000)}} className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors">{copiedContent ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}{copiedContent ? '已複製' : '複製貼文'}</button></div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed text-slate-700 shadow-sm min-h-[300px]">{data.content}</div>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between"><h3 className="font-bold text-slate-800 text-lg flex items-center gap-2"><Palette className="w-5 h-5 text-purple-600" /> AI 配圖建議</h3><button onClick={()=>{navigator.clipboard.writeText(data.image_prompt);setCopiedPrompt(true);setTimeout(()=>setCopiedPrompt(false),2000)}} className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-purple-600 transition-colors">{copiedPrompt ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}{copiedPrompt ? '已複製' : '複製 Prompt'}</button></div>
        <div className="bg-gradient-to-b from-purple-50 to-white p-6 rounded-xl border border-purple-100 shadow-sm h-full"><div className="text-sm text-purple-800 font-bold mb-2">Image Prompt</div><p className="text-slate-600 text-sm leading-relaxed font-mono break-words mb-4">{data.image_prompt}</p><div className="text-xs text-slate-400 border-t border-purple-100 pt-3 mt-auto">* 此提示詞適用於 Gemini Nano, Filmora 15, Midjourney 等生成工具。</div></div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return <button onClick={onClick} className={`flex-1 py-4 font-medium text-sm flex items-center justify-center gap-2 transition-all ${active ? 'text-indigo-600 bg-white shadow-sm border-t-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}>{icon} {label}</button>;
}