
import React, { useState, useRef, useEffect } from 'react';
import { extractTextFromFile } from './services/documentProcessor';
import { analyzeAllResumes } from './services/geminiService';
import { Candidate, AnalysisResult, ProcessingState } from './types';
import { CandidateCard } from './components/CandidateCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GoogleGenAI } from "@google/genai";

// @ts-ignore - Loaded from script tag in index.html
const { PDFDocument, rgb, StandardFonts } = window.PDFLib;

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const App: React.FC = () => {
  const [jobDescription, setJobDescription] = useState<string>('');
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
  const [extractedTexts, setExtractedTexts] = useState<{ name: string; text: string }[]>([]);
  const [processing, setProcessing] = useState<ProcessingState>({
    status: 'idle',
    progress: 0,
    message: ''
  });

  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const clearFiles = () => {
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setResults(null);
    setMergedPdfUrl(null);
    setExtractedTexts([]);
    setChatMessages([]);
    setProcessing({ status: 'idle', progress: 0, message: '' });
  };

  const mergeDocuments = async (filesToMerge: File[]) => {
    setProcessing(prev => ({ ...prev, message: 'Combining all resumes into one master document...' }));
    const mergedPdf = await PDFDocument.create();
    const font = await mergedPdf.embedFont(StandardFonts.Helvetica);
    
    for (let i = 0; i < filesToMerge.length; i++) {
      const file = filesToMerge[i];
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      try {
        if (extension === 'pdf') {
          const pdfBytes = await file.arrayBuffer();
          const pdf = await PDFDocument.load(pdfBytes);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page: any) => mergedPdf.addPage(page));
        } else if (extension === 'docx') {
          const text = await extractTextFromFile(file);
          const page = mergedPdf.addPage();
          const { width, height } = page.getSize();
          
          page.drawText(`--- SOURCE: ${file.name} ---`, {
            x: 50,
            y: height - 50,
            size: 14,
            font,
            color: rgb(0, 0, 0.5)
          });
          
          const lines = text.split('\n').slice(0, 40);
          lines.forEach((line, index) => {
            page.drawText(line.substring(0, 80), {
              x: 50,
              y: height - 80 - (index * 15),
              size: 10,
              font
            });
          });
        }
        
        const mergeProgress = Math.round(((i + 1) / filesToMerge.length) * 20);
        setProcessing(prev => ({ ...prev, progress: mergeProgress }));
      } catch (err) {
        console.warn(`Could not include ${file.name} in master merge`, err);
      }
    }
    
    const mergedPdfBytes = await mergedPdf.save();
    const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
  };

  const runAnalysis = async () => {
    if (!jobDescription || files.length === 0) {
      alert("Please provide both a Job Description and at least one Resume file.");
      return;
    }

    try {
      setProcessing({ 
        status: 'parsing', 
        progress: 0, 
        message: `Analyzing pool of ${files.length} resumes...` 
      });
      
      const masterUrl = await mergeDocuments(files);
      setMergedPdfUrl(masterUrl);

      const allExtractedData: { name: string; text: string }[] = [];
      for (let i = 0; i < files.length; i++) {
        const text = await extractTextFromFile(files[i]);
        allExtractedData.push({ name: files[i].name, text });
        setProcessing(prev => ({ 
          ...prev, 
          progress: 20 + Math.round(((i + 1) / files.length) * 30),
          message: `Extracting data: ${i + 1} of ${files.length}...`
        }));
      }

      setExtractedTexts(allExtractedData);

      setProcessing(prev => ({ 
        ...prev, 
        status: 'analyzing', 
        message: 'Running Unified AI Analysis on all candidates...' 
      }));
      
      const analysisResult = await analyzeAllResumes(jobDescription, allExtractedData);
      
      setResults(analysisResult);
      setProcessing({ status: 'completed', progress: 100, message: 'Screening Complete!' });
      
      // Initialize chat with a welcome message
      setChatMessages([{
        role: 'model',
        text: "The candidate pool is ready. You can ask me specific questions like 'Who has the most React experience?' or 'Compare the top 2 candidates' fit for this role'."
      }]);
    } catch (error) {
      console.error(error);
      setProcessing({ 
        status: 'error', 
        progress: 0, 
        message: 'Analysis failed. The resume pool might be too large for a single request or contain invalid data.' 
      });
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim() || isTyping) return;

    const userMsg = userInput;
    setUserInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const context = extractedTexts.map(t => `[Candidate: ${t.name}]\n${t.text}`).join("\n---\n");
      
      const prompt = `
        You are an HR Assistant. You have access to a pool of ${extractedTexts.length} resumes.
        
        CONTEXT (THE CANDIDATE POOL):
        ${context}
        
        JOB DESCRIPTION:
        ${jobDescription}
        
        USER QUESTION:
        ${userMsg}
        
        Instruction: Answer the question accurately based on the provided resumes. Be concise but thorough.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });

      setChatMessages(prev => [...prev, { role: 'model', text: response.text || "I couldn't generate a response." }]);
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error while processing your request." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const chartData = results?.topCandidates.slice(0, 10).map(c => ({
    name: c.name.split(' ')[0],
    score: c.score
  })) || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-20 selection:bg-blue-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Talent Scout Pro</h1>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest">Unified Resume Intelligence</p>
            </div>
          </div>
          {results && (
            <button 
              onClick={clearFiles}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-bold transition-all"
            >
              Start New Analysis
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {!results ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-8">
              <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Job Specifications</h2>
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-black">AI-READY</span>
                </div>
                <div className="p-8">
                  <textarea
                    placeholder="Paste your job description here. Our AI will analyze the entire resume pool against these specific criteria simultaneously."
                    className="w-full h-72 text-base text-slate-700 bg-slate-50 border border-slate-200 rounded-2xl p-6 focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all resize-none"
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                  />
                </div>
              </section>

              <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Upload Resumes ({files.length})</h2>
                  <div className="flex gap-4 items-center">
                    {files.length > 0 && (
                      <button onClick={clearFiles} className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase">Clear All</button>
                    )}
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded font-black">Unlimited Files</span>
                  </div>
                </div>
                <div className="p-8">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative group border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-12 transition-all cursor-pointer bg-slate-50/50 hover:bg-blue-50/30 text-center"
                  >
                    <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx" onChange={handleFileChange} className="hidden" />
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                      <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                    </div>
                    <p className="text-lg font-bold text-slate-800">Upload All Candidate Files</p>
                    <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">Drop your entire recruitment pool here. We'll handle everything in one go.</p>
                  </div>
                  
                  {files.length > 0 && (
                    <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                      {files.map((file, idx) => (
                        <div key={idx} className="bg-white border border-slate-100 p-3 rounded-xl flex items-center gap-3 shadow-sm hover:border-blue-200 transition-colors group">
                          <div className={`shrink-0 w-8 h-8 rounded flex items-center justify-center text-[10px] font-black ${file.name.endsWith('pdf') ? 'bg-blue-50 text-blue-500' : 'bg-emerald-50 text-emerald-500'}`}>
                            {file.name.split('.').pop()?.toUpperCase()}
                          </div>
                          <span className="text-[11px] font-medium text-slate-600 truncate group-hover:text-blue-600">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="lg:col-span-5 space-y-8">
              <div className="bg-slate-900 rounded-[32px] p-10 text-white shadow-2xl shadow-slate-900/20 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-2xl -mb-10 -mr-10" />
                <h3 className="text-2xl font-bold mb-8">Unified Intelligence</h3>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div>
                      <p className="font-bold text-white">Full-Pool Context</p>
                      <p className="text-xs text-slate-400">Gemini analyzes the entire set in one context window for better relative ranking.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <p className="font-bold text-white">Master Consolidation</p>
                      <p className="text-xs text-slate-400">A single unified document is generated for all candidates.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-12">
                  <button
                    disabled={processing.status !== 'idle' && processing.status !== 'error'}
                    onClick={runAnalysis}
                    className={`w-full py-5 rounded-2xl font-bold text-white shadow-xl transition-all flex items-center justify-center gap-4 ${
                      processing.status === 'idle' || processing.status === 'error'
                        ? 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 active:scale-95'
                        : 'bg-slate-700 cursor-not-allowed'
                    }`}
                  >
                    {processing.status === 'idle' ? (
                      <>
                        <span>Process All Resumes Now</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 border-2 border-blue-400 border-t-white rounded-full animate-spin" />
                        <span>Processing All...</span>
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {processing.status !== 'idle' && (
                <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 p-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Unified Analysis Progress</h3>
                    <span className="text-xl font-black text-blue-600">{processing.progress}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-3 mb-6 overflow-hidden">
                    <div className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${processing.progress}%` }} />
                  </div>
                  <p className="text-sm font-bold text-slate-700 mb-1">{processing.message}</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-1000">
            {/* Dashboard Results */}
            <div className="bg-white rounded-[48px] p-12 shadow-2xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full -mr-32 -mt-32 blur-3xl" />
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
                <div className="lg:col-span-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight">Full Pool Analysis</h2>
                  </div>
                  <p className="text-xl text-slate-600 leading-relaxed mb-10 max-w-3xl font-medium">{results.summary}</p>
                  
                  <div className="flex flex-wrap gap-6">
                    {mergedPdfUrl && (
                      <a 
                        href={mergedPdfUrl} 
                        download="Full_Recruitment_Pool.pdf"
                        className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-bold flex items-center gap-4 hover:bg-blue-600 transition-all shadow-2xl shadow-slate-900/20 active:scale-95 group"
                      >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Download Consolidated Master File
                      </a>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-4">
                   <div className="w-full bg-slate-50/50 rounded-[40px] p-8 border border-slate-100/50 h-full flex flex-col">
                    <h4 className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-8 text-center">Top Match Scores</h4>
                    <div className="flex-1 min-h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <Bar dataKey="score" radius={[6, 6, 6, 6]} barSize={20}>
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#3b82f6'} fillOpacity={1 - (index * 0.08)} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                   </div>
                </div>
              </div>
            </div>

            {/* INTERACTION SECTION: CHAT WITH POOL */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-4 flex flex-col space-y-4">
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[500px]">
                  <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </div>
                    <h3 className="font-bold text-slate-800">Pool Assistant</h3>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl p-3 text-sm ${
                          msg.role === 'user' 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-slate-100 text-slate-700 rounded-tl-none border border-slate-200'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="bg-slate-100 rounded-2xl rounded-tl-none p-3 border border-slate-200">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  <div className="p-4 border-t border-slate-100 bg-white">
                    <div className="relative">
                      <input 
                        type="text" 
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder="Ask about candidates..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-4 pr-12 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      />
                      <button 
                        onClick={handleSendMessage}
                        disabled={isTyping}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors disabled:bg-slate-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                  <p className="text-[10px] text-blue-800 font-bold uppercase tracking-widest mb-1">HR Tip</p>
                  <p className="text-xs text-blue-600 leading-relaxed">Try: "Who has the most years of experience in leadership roles?"</p>
                </div>
              </div>

              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between px-4">
                  <h3 className="text-xl font-bold text-slate-800">Top Ranked Candidates</h3>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ranked by Suitability</div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {results.topCandidates.map((candidate, idx) => (
                    <div key={idx} className="animate-in fade-in slide-in-from-bottom-10" style={{ animationDelay: `${idx * 40}ms` }}>
                      <CandidateCard candidate={candidate} rank={idx + 1} />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
