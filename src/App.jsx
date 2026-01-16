import React, { useState, useEffect } from 'react';
// 注意：在本機 VS Code 執行時，請務必取消下面這行的註解，樣式才會生效！
// import './index.css'; 
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
  MessageCircle
} from 'lucide-react';

// --- 設定區：API Key ---
// 為了避免編譯錯誤 (import.meta 在此環境不支援)，這裡直接使用字串。
// 若您在本機 Vite 環境下，可以改回 import.meta.env.VITE_GEMINI_API_KEY
const FIXED_API_KEY = "AIzaSyARQlNaq5jzChL95NStRGbugaY4hhHEy0A"; 

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
  const [officialAccount, setOfficialAccount] = useState(''); 
  
  // 生成結果狀態
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('script'); 

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
      setError('未檢測到 API Key，請檢查程式碼設定或環境變數。');
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
    setStatusMessage('正在分析內容...');

    try {
      let baseContent = '';
      let keywords = [];
      
      if (mode === 'text') {
        const analysis = await analyzeTextWithGemini(inputText, apiKey);
        baseContent = analysis.summary;
        keywords = analysis.keywords;
      } else {
        // 圖片模式：呼叫升級版分析
        const analysis = await analyzeImageWithGemini(selectedImage, apiKey);
        baseContent = analysis.text;
        keywords = analysis.keywords;
      }

      // 依序生成腳本與貼文
      setStatusMessage('正在撰寫短影音腳本 (1/2)... (稍候 3 秒)');
      await delay(3000); 
      const scriptData = await generateVideoScript(baseContent, keywords, videoLength, apiKey);
      
      setStatusMessage('正在撰寫社群貼文 (2/2)... (稍候 5 秒)');
      await delay(5000);
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
      } else if (msg.includes('403')) {
        setError('權限錯誤 (403)：您的 API Key 可能無法存取此模型，或模型版本不支援。已嘗試自動切換為 gemini-1.5-flash。');
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

  // --- 1. 分析文字 ---
  async function analyzeTextWithGemini(text, key) {
    const prompt = `
      你是一個專業的房地產分析師。請分析以下內容：
      "${text}"
      任務：擷取重點摘要 (Summary) 與 5-8 個關鍵字 (Keywords)。
      請回傳 JSON：{ "summary": "...", "keywords": ["..."] }
    `;
    const response = await callGeminiAPI(prompt, key, true);
    return safeJsonParse(response);
  }

  // --- 2. 分析圖片 (★重要更新★：使用 gemini-1.5-flash 以避免 403 錯誤) ---
  async function analyzeImageWithGemini(file, key) {
    if (!imagePreview) throw new Error("圖片資料尚未準備好，請重新上傳");
    const base64Data = imagePreview.split(',')[1];
    
    // 升級版 Prompt：具備判斷能力
    const promptText = `你是一位專業的房地產文案專家。請先判斷這張圖片的類型，再進行資訊擷取：

情況 A：如果是【房地產物件銷售】(如傳單、格局圖、建物照片)：
- 請擷取：總價、單價、坪數、格局、樓層、屋齡、地點、賣點。

情況 B：如果是【政策/新聞/市場資訊】(如新聞截圖、政府公告、數據圖表)：
- 請擷取：政策名稱/標題、關鍵日期(實施日)、影響對象、主要變革重點、市場數據趨勢。

【最終輸出】：請將辨識到的資訊整理成一段通順的「重點摘要」，並提取 5 個關鍵字。

請以 JSON 格式回傳：
{
  "text": "整合後的重點摘要內容...",
  "keywords": ["關鍵字1", "關鍵字2", "關鍵字3", "關鍵字4", "關鍵字5"]
}`;

    const payload = {
      contents: [{
        parts: [
          { text: promptText }, 
          { inline_data: { mime_type: file.type, data: base64Data } }
        ]
      }],
      generationConfig: { responseMimeType: "application/json" }
    };
    return await retryFetchImage(payload, key);
  }

  // 圖片分析重試邏輯
  async function retryFetchImage(payload, key, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        // ★★★ 關鍵修改：將模型改為更穩定的 gemini-1.5-flash ★★★
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          if (response.status === 429) {
            const waitTime = (i + 1) * 5000;
            console.warn(`[Image] Quota exceeded. Retrying in ${waitTime}ms...`);
            setStatusMessage(`API 忙碌中，等待 ${waitTime/1000} 秒後重試...`);
            await delay(waitTime);
            continue;
          }
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(`API Error: ${response.status} ${errorBody.error?.message || ''}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);

        const candidate = data.candidates?.[0];
        const text = candidate?.content?.parts?.[0]?.text;
        
        if (!text) {
             console.warn("API response empty");
             throw new Error(`AI 無法辨識圖片內容 (回應為空)`);
        }
        
        return safeJsonParse(String(text));

      } catch (e) {
        if (i === retries - 1) throw e;
        await delay(2000);
      }
    }
  }

  // --- 3. 生成短影音腳本 ---
  async function generateVideoScript(content, keywords, seconds, key) {
    const prompt = `
      你是一個短影音行銷專家。請根據以下房地產資訊生成一支 ${seconds} 秒的口播腳本。
      資訊：${content}
      關鍵字：${keywords.join(', ')}
      
      請嚴格遵守 JSON 格式回傳，結構如下：
      {
        "template_name": "選用的爆款架構名稱 (如：痛點放大法)",
        "hooks": ["鉤子選項1", "鉤子選項2", "鉤子選項3"],
        "titles": ["標題建議1", "標題建議2", "標題建議3"],
        "scenes": [
          {
            "time": "0-3s",
            "visual": "畫面描述",
            "image_prompt": "英文 AI 繪圖提示詞 (Midjourney style, photorealistic, cinematic lighting...)",
            "audio": "口播文案"
          }
        ],
        "cta": "結尾行動呼籲"
      }
    `;
    const response = await callGeminiAPI(prompt, key, true);
    return safeJsonParse(response);
  }

  // --- 4. 生成 FB/IG 貼文 ---
  async function generateSocialPost(content, keywords, length, account, key) {
    const lengthMap = { short: '短篇', medium: '中篇', long: '長篇' };
    
    let ctaInstruction = "(請自行撰寫吸引人的 CTA)";
    if (account) {
      ctaInstruction = `(請務必在文末 CTA 加入固定文字：「歡迎加入LINE官方帳號獲得更多資訊: ${account}」)`;
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
    const response = await callGeminiAPI(prompt, key, true);
    return safeJsonParse(response);
  }

  // 通用 API 呼叫
  async function callGeminiAPI(prompt, key, isJson = false, retries = 3) {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: isJson ? { responseMimeType: "application/json" } : undefined
    };

    for (let i = 0; i < retries; i++) {
      try {
        // ★★★ 關鍵修改：將模型改為更穩定的 gemini-1.5-flash ★★★
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if (response.status === 429) {
            const waitTime = (i + 1) * 5000;
            console.warn(`Quota exceeded. Retrying in ${waitTime}ms...`);
            setStatusMessage(`API 流量管制中 (429)，休息 ${waitTime/1000} 秒後繼續...`);
            await delay(waitTime);
            continue;
          }
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(`API Error: ${response.status} ${errorBody.error?.message || ''}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error.message);
        
        const candidate = data.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const text = candidate?.content?.parts?.[0]?.text;
        
        if (!text) {
             console.warn("API response empty. Finish Reason:", finishReason);
             if (finishReason === 'SAFETY') throw new Error("內容被 AI 安全過濾器阻擋");
             if (finishReason === 'RECITATION') throw new Error("內容重複性過高，AI 拒絕生成");
             if (finishReason === 'OTHER') throw new Error("API 伺服器忙碌中，請重試");
             throw new Error(`AI 回應為空 (原因: ${finishReason || '未知'})`);
        }
        
        return String(text);

      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error);
        if (i === retries - 1) throw error;
        if (!error.message.includes('Quota exceeded')) {
             await delay(3000); 
        }
      }
    }
    throw new Error("API 重試次數已達上限，無法取得回應");
  }

  // --- 安全的 JSON 解析器 ---
  function safeJsonParse(input) {
    if (input === null || input === undefined) {
        throw new Error("系統錯誤：AI 回傳了無效的空資料");
    }

    let str = input;
    if (typeof str !== 'string') {
        try { str = JSON.stringify(str); } catch (e) { str = String(str); }
    }

    let cleaned = str.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const startIndex = cleaned.indexOf('{');
    const endIndex = cleaned.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
      cleaned = cleaned.substring(startIndex, endIndex + 1);
    }
    
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      const fixed = cleaned.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
      try {
        return JSON.parse(fixed);
      } catch (e2) {
        console.error("JSON Parse Error. Input:", cleaned);
        throw new Error("AI 回傳資料格式損壞，請重新生成");
      }
    }
  }

  // --- UI 部分 ---
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center justify-center gap-2">
            <Wand2 className="w-8 h-8 text-indigo-600" />
            房地產AI智能行銷專家
          </h1>
          <p className="text-slate-500">API Key 已就緒 ✨ 準備生成爆款內容</p>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-200">
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setMode('text')}
              className={`flex-1 py-4 font-medium flex justify-center gap-2 ${mode === 'text' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LinkIcon className="w-5 h-5" /> 文章/網址輸入
            </button>
            <button
              onClick={() => setMode('image')}
              className={`flex-1 py-4 font-medium flex justify-center gap-2 ${mode === 'image' ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <ImageIcon className="w-5 h-5" /> 圖片/傳單辨識
            </button>
          </div>

          <div className="p-6 space-y-6">
            {mode === 'text' ? (
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="請貼上房地產新聞、文章內容或售屋資訊..."
                className="w-full h-32 p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none bg-slate-50"
              />
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

            {/* 新增：官方帳號輸入欄位 */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-1">
                <MessageCircle className="w-4 h-4" /> 預設官方帳號 (將自動加入貼文 CTA)
              </label>
              <input 
                type="text" 
                value={officialAccount} 
                onChange={(e) => setOfficialAccount(e.target.value)}
                placeholder="例如：Line ID @house123 或 https://line.me/..."
                className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50"
              />
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
                  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-yellow-500" /> 關鍵字</h3>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((kw, idx) => <span key={idx} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-sm font-medium">#{kw}</span>)}
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4">內容摘要</h3>
                    <p className="text-slate-600 leading-relaxed">{result.analysis}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- 子元件：視覺化腳本顯示器 ---
function ScriptVisualizer({ data }) {
  const [copied, setCopied] = useState(false);

  // 將 JSON 轉回文字以便複製
  const handleCopy = () => {
    let text = `【${data.template_name}】短影音腳本\n\n`;
    text += `🔥 鉤子推薦：\n${data.hooks.map((h, i) => `${i + 1}. ${h}`).join('\n')}\n\n`;
    text += `📌 標題推薦：\n${data.titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n`;
    text += `🎬 分鏡腳本：\n`;
    data.scenes.forEach((s) => {
      text += `[${s.time}] 畫面：${s.visual}\n提示詞：${s.image_prompt}\n口播：${s.audio}\n\n`;
    });
    text += `📢 CTA：${data.cta}`;
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 頂部策略區 */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-4 opacity-90">
            <Lightbulb className="w-5 h-5" />
            <span className="text-sm font-bold tracking-wider uppercase">Strategy</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">{data.template_name}</h2>
          <p className="text-indigo-100 text-sm">此腳本採用的熱門流量架構</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
           <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
             <Check className="w-5 h-5 text-green-500" /> 爆款標題建議
           </h3>
           <ul className="space-y-2">
             {data.titles.map((title, idx) => (
               <li key={idx} className="flex items-start gap-2 text-slate-700 text-sm">
                 <span className="bg-slate-100 text-slate-500 px-1.5 rounded text-xs mt-0.5">{idx+1}</span>
                 {title}
               </li>
             ))}
           </ul>
        </div>
      </div>

      {/* 黃金三秒鉤子 */}
      <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
        <h3 className="font-bold text-orange-800 mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5" /> 黃金 3 秒鉤子 (任選其一)
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {data.hooks.map((hook, idx) => (
            <div key={idx} className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm text-sm text-slate-700 font-medium">
              "{hook}"
            </div>
          ))}
        </div>
      </div>

      {/* 分鏡時間軸 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Clapperboard className="w-5 h-5 text-indigo-600" /> 拍攝分鏡表
          </h3>
          <button onClick={handleCopy} className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 transition-colors">
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copied ? '已複製' : '複製全部'}
          </button>
        </div>

        <div className="space-y-4">
          {data.scenes.map((scene, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row">
              {/* 時間碼 */}
              <div className="md:w-24 bg-slate-50 p-4 flex items-center justify-center border-b md:border-b-0 md:border-r border-slate-100">
                <div className="text-center">
                  <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                  <span className="font-mono font-bold text-slate-600">{scene.time}</span>
                </div>
              </div>

              {/* 畫面與提示詞 */}
              <div className="flex-1 p-5 border-b md:border-b-0 md:border-r border-slate-100">
                <div className="flex items-start gap-2 mb-3">
                  <ImageIcon className="w-4 h-4 text-indigo-500 mt-1 shrink-0" />
                  <p className="text-slate-800 font-medium">{scene.visual}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 border border-slate-100">
                  <div className="flex items-center gap-1 mb-1 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                    <Palette className="w-3 h-3" /> AI Image Prompt
                  </div>
                  <p className="font-mono leading-relaxed select-all cursor-text hover:text-slate-700 transition-colors">
                    {scene.image_prompt}
                  </p>
                </div>
              </div>

              {/* 口播稿 */}
              <div className="flex-1 p-5 bg-yellow-50/30">
                <div className="flex items-start gap-2">
                  <Mic className="w-4 h-4 text-yellow-600 mt-1 shrink-0" />
                  <p className="text-slate-700 leading-relaxed font-medium">
                    {scene.audio}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg flex items-start gap-3">
        <div className="font-bold text-indigo-800 shrink-0">CTA 行動呼籲：</div>
        <p className="text-indigo-700">{data.cta}</p>
      </div>
    </div>
  );
}

// --- 子元件：社群貼文視覺化 (升級版) ---
function SocialPostVisualizer({ data }) {
  const [copiedContent, setCopiedContent] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const handleCopyContent = () => {
    navigator.clipboard.writeText(data.content);
    setCopiedContent(true);
    setTimeout(() => setCopiedContent(false), 2000);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(data.image_prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="grid md:grid-cols-3 gap-6 animate-in fade-in duration-500">
      {/* 左側：貼文內容 */}
      <div className="md:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Facebook className="w-5 h-5 text-blue-600" /> 貼文內容
          </h3>
          <button onClick={handleCopyContent} className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors">
            {copiedContent ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copiedContent ? '已複製' : '複製貼文'}
          </button>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 whitespace-pre-wrap leading-relaxed text-slate-700 shadow-sm min-h-[300px]">
          {data.content}
        </div>
      </div>

      {/* 右側：圖片提示詞 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
            <Palette className="w-5 h-5 text-purple-600" /> AI 配圖建議
          </h3>
          <button onClick={handleCopyPrompt} className="text-sm flex items-center gap-1.5 text-slate-500 hover:text-purple-600 transition-colors">
            {copiedPrompt ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            {copiedPrompt ? '已複製' : '複製 Prompt'}
          </button>
        </div>

        <div className="bg-gradient-to-b from-purple-50 to-white p-6 rounded-xl border border-purple-100 shadow-sm h-full">
           <div className="text-sm text-purple-800 font-bold mb-2">Image Prompt</div>
           <p className="text-slate-600 text-sm leading-relaxed font-mono break-words mb-4">
             {data.image_prompt}
           </p>
           <div className="text-xs text-slate-400 border-t border-purple-100 pt-3 mt-auto">
             * 此提示詞適用於 Gemini Nano, Filmora 15, Midjourney 等生成工具。
           </div>
        </div>
      </div>
    </div>
  );
}

// 簡單的 Tab 按鈕元件
function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-4 font-medium text-sm flex items-center justify-center gap-2 transition-all ${active ? 'text-indigo-600 bg-white shadow-sm border-t-2 border-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
    >
      {icon} {label}
    </button>
  );
}