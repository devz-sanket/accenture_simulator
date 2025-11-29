
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Configuration & Constants ---

// REPLACE THIS STRING WITH YOUR REAL GEMINI API KEY
// The app will strictly use this key to generate questions.
const DEFAULT_API_KEY = "AIzaSyBrvhL2-96ONPFruh4ILzSq88BSy0GRedM"; 

// Using Gemini 2.5 Flash for speed and efficiency
const GEN_MODEL = "gemini-2.5-flash"; 

const CONFIG = {
  totalTime: 45 * 60, // 45 minutes
  passPercent: 60,
  qCount: 45,
  maxWarnings: 5
};

// --- Types ---

type Screen = 'landing' | 'loading' | 'instructions' | 'play' | 'results';

interface MCQ {
  id: string;
  stem: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: 'Pseudocode' | 'Data Structures' | 'Algorithms' | 'Core CS Subjects' | string;
  isRepeat?: boolean; // New flag for "Previous Year Pattern"
}

interface AppState {
  screen: Screen;
  loadingMessage: string;
  mcqs: MCQ[];
  mcqAnswers: Record<string, number>;
  mcqFlags: Record<string, boolean>;
  mcqSkipped: Record<string, boolean>;
  timeLeft: number;
  apiKey: string;
}

// --- SVG Icons ---
const Icons = {
  Code: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>,
  Clock: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  CheckCircle: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  AlertCircle: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  Flag: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-8a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5-5 5H5a2 2 0 01-2 2v2" /></svg>,
  ChevronRight: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>,
  ChevronLeft: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>,
  Skip: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>,
  Menu: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>,
  Shield: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Maximize: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
  Linkedin: () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>,
  Mail: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  Flame: () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
};

// --- AI Logic ---

const generateAssessmentContent = async (apiKey: string) => {
  const ai = new GoogleGenAI({ apiKey });
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      mcqs: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            stem: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
            difficulty: { type: Type.STRING },
            topic: { type: Type.STRING },
            isRepeat: { type: Type.BOOLEAN, description: "True if this matches a high-frequency previous year Accenture pattern" }
          }
        }
      }
    }
  };

  const fetchBatch = async (count: number, focus: string) => {
    const prompt = `
      Act as an Expert Accenture Exam Setter (2026 Simulator).
      Generate ${count} Technical MCQs.
      
      ANALYSIS PATTERNS (Mimic these strictly):
      ${focus}

      DISTRIBUTION RULES:
      - 30% Easy, 50% Medium, 20% Hard.
      - Options must be TRICKY (e.g., 'None of these', 'Compiler Error', slight syntax errors).
      - Include "isRepeat": true for questions that are classic repeats (Stack sequences, Matrix logic, Hashing).

      FORMAT:
      - Pseudocode must use C syntax in markdown \`\`\`c ... \`\`\`.
    `;
    
    const resp = await ai.models.generateContent({
      model: GEN_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema
      }
    });

    // @ts-ignore
    return JSON.parse(resp.text).mcqs || [];
  };

  // Parallelize requests to speed up loading
  const [batch1, batch2, batch3] = await Promise.all([
    fetchBatch(15, "ARCHETYPE A (Pseudocode): Matrix manipulation (transpose/swapping logic), Recursive function tracing, Bitwise XOR swap, Pre/Post increment precedence (undefined behavior)."),
    fetchBatch(15, "ARCHETYPE B (DSA): Stack Push/Pop sequences (predict output), Hash Table chaining (k mod n collisions), Binary Tree properties (Leaf node formula), Linked List loop detection."),
    fetchBatch(15, "ARCHETYPE C (Core): OSI Model (Layer 4/3 functions), Cloud Computing (IaaS/SaaS definitions), MS Excel shortcuts (Date/Time), IP Addressing classes, Round Robin scheduling.")
  ]);

  const allMcqs = [...batch1, ...batch2, ...batch3].map((q: any, i: number) => ({
    ...q,
    id: `gen-${Date.now()}-${i}` // Ensure unique IDs
  }));

  return { mcqs: allMcqs };
};

// --- Helper Components ---

const Button = ({ children, variant = 'primary', className = '', icon = null, ...props }: any) => {
  const base = "flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-brand-purple hover:bg-purple-700 text-white shadow-lg shadow-purple-900/20",
    secondary: "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300",
    ghost: "text-gray-500 hover:text-brand-purple hover:bg-purple-50",
    danger: "bg-red-50 text-red-600 hover:bg-red-100",
    outline: "border-2 border-brand-purple text-brand-purple hover:bg-purple-50"
  };
  return (
    <button className={`${base} ${variants[variant as keyof typeof variants]} ${className}`} {...props}>
      {icon}
      {children}
    </button>
  );
};

const Footer = () => (
  <footer className="w-full bg-brand-black/95 text-gray-400 py-6 px-4 border-t border-gray-800 relative z-50">
    <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
      <div className="text-sm font-medium">
        Made by <span className="text-white">Sanket Pundhir</span>
      </div>
      <div className="flex items-center gap-6">
        <a 
          href="https://www.linkedin.com/in/sanket-pundhir-techie/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm hover:text-brand-purple transition-colors cursor-pointer"
        >
          <Icons.Linkedin /> LinkedIn
        </a>
        <a 
          href="mailto:sanketpundhir@gmail.com" 
          className="flex items-center gap-2 text-sm hover:text-brand-purple transition-colors cursor-pointer"
        >
          <Icons.Mail /> Contact
        </a>
      </div>
    </div>
  </footer>
);

const ProctorWarningModal = ({ 
  warnings, 
  onAcknowledge,
  onQuit,
  reason 
}: { 
  warnings: number, 
  onAcknowledge: () => void,
  onQuit: () => void,
  reason: string 
}) => {
  const remaining = CONFIG.maxWarnings - warnings;
  
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl max-w-md w-full p-8 shadow-2xl border-4 border-red-500 animate-[pulse-fast_2s_infinite]">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-2">
            <Icons.Shield />
          </div>
          <h2 className="text-2xl font-bold text-red-600">PROCTOR WARNING</h2>
          
          <div className="space-y-2">
             <p className="font-bold text-gray-800 text-lg">{reason}</p>
             <p className="text-gray-600">
                You have violated the proctoring protocol. The test must be taken in Full Screen mode without switching tabs.
             </p>
          </div>

          <div className="bg-red-50 p-4 rounded-lg w-full">
            <div className="text-sm font-bold text-red-800 uppercase tracking-wide mb-1">Warning Count</div>
            <div className="text-4xl font-black text-red-600">{warnings} / {CONFIG.maxWarnings}</div>
            <p className="text-xs text-red-500 mt-2 font-medium">
              {remaining > 0 ? `${remaining} attempt(s) remaining before automatic elimination.` : "Test will be terminated."}
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <Button 
                onClick={onAcknowledge} 
                className="w-full bg-red-600 hover:bg-red-700"
            >
                I Understand - Resume Test
            </Button>
            <button 
                onClick={onQuit}
                className="text-sm text-gray-500 underline hover:text-red-600 font-medium py-2"
            >
                I want to Quit & Submit Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Text/Code Renderer ---
const FormattedText = ({ text }: { text: string }) => {
  if (!text) return null;
  const parts = text.split(/```/g);
  return (
    <div className="space-y-4 w-full">
      {parts.map((part, index) => {
        if (index % 2 === 1) {
          // This block is code
          let content = part.trim();
          // Strip language identifier if present (e.g., "c\n")
          if (content.match(/^(c|cpp|java|python|javascript|ts)\n/)) {
             content = content.split('\n').slice(1).join('\n');
          }
          return (
            <div key={index} className="rounded-lg overflow-hidden my-3 border border-gray-700 shadow-md">
              <div className="bg-gray-800 px-4 py-1.5 flex items-center gap-2 border-b border-gray-700">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="ml-2 text-xs text-gray-400 font-mono">pseudocode.c</span>
              </div>
              <pre className="bg-[#1e1e1e] p-4 overflow-x-auto text-sm md:text-base text-gray-300 font-mono leading-relaxed select-none w-full">
                <code>{content}</code>
              </pre>
            </div>
          );
        } else {
          // This block is regular text
          if (!part.trim()) return null;
          return (
            <span key={index} className="whitespace-pre-wrap">
              {part}
            </span>
          );
        }
      })}
    </div>
  );
};

const Layout = ({ children, timeLeft, title, section, onMenuClick }: any) => {
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isCritical = timeLeft < 300; // Last 5 mins

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans select-none">
      {/* Top Bar */}
      <header className="bg-brand-black text-white h-16 flex items-center justify-between px-6 sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="lg:hidden text-gray-400 hover:text-white" type="button">
            <Icons.Menu />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-purple rounded-md flex items-center justify-center">
              <span className="font-bold text-lg text-white">{'>'}</span>
            </div>
            <span className="font-bold tracking-tight text-lg hidden sm:block">Accenture<span className="font-light text-gray-400">Simulator</span></span>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2 text-green-400 text-xs font-bold border border-green-500/30 bg-green-500/10 px-2 py-1 rounded">
             <Icons.Shield /> PROCTOR ACTIVE
           </div>
          <div className="hidden md:block text-sm text-gray-400">
            {section} <span className="mx-2">|</span> {title}
          </div>
          <div className={`flex items-center gap-2 font-mono text-xl font-bold px-4 py-1 rounded bg-gray-800 border ${isCritical ? 'border-red-500 text-red-500 animate-pulse' : 'border-gray-700 text-brand-purple'}`}>
            <Icons.Clock />
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
};

// --- Sub-Screens ---

const LandingScreen = ({ onStart }: { onStart: () => void }) => {
  return (
    <div className="min-h-screen flex flex-col bg-brand-black text-white relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-brand-purple rounded-full mix-blend-multiply filter blur-[120px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-600 rounded-full mix-blend-multiply filter blur-[100px] opacity-10"></div>
      
      <div className="flex-1 flex items-center justify-center relative z-10">
        <div className="max-w-4xl px-6 text-center">
          <div className="inline-block px-4 py-1.5 rounded-full border border-gray-700 bg-gray-900/50 backdrop-blur-md text-sm font-medium text-gray-300 mb-8">
            Expert Accenture 2026 Simulator
          </div>
          <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-8">
            Accenture<span className="text-brand-purple">Tech</span>
          </h1>
          <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Practice with highly accurate predicted questions based on 2024-2025 patterns.
            Includes Pseudocode, DSA, Networking, and Cloud.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Button onClick={onStart} className="text-lg py-4 px-12 shadow-brand-purple/50">
              Start Predicted Exam
            </Button>
          </div>
          
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm text-gray-500 border-t border-gray-800 pt-8">
            <div>
              <div className="text-white font-bold text-lg mb-1">45 Questions</div>
              <div>30% Easy, 50% Med, 20% Hard</div>
            </div>
            <div>
              <div className="text-white font-bold text-lg mb-1">45 Mins</div>
              <div>Real Exam Timing</div>
            </div>
            <div>
              <div className="text-white font-bold text-lg mb-1">Proctoring</div>
              <div>Anti-Cheat Enabled</div>
            </div>
            <div>
              <div className="text-white font-bold text-lg mb-1">Patterns</div>
              <div>Previous Year Matches</div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

const LoadingScreen = ({ message }: { message: string }) => (
  <div className="min-h-screen bg-white flex flex-col items-center justify-center">
    <div className="w-16 h-16 border-4 border-gray-200 border-t-brand-purple rounded-full animate-spin mb-6"></div>
    <h2 className="text-xl font-bold text-gray-800 animate-pulse">{message}</h2>
    <p className="text-gray-500 mt-2 text-sm">Aggregating questions from predicted patterns...</p>
  </div>
);

const InstructionsScreen = ({ onStart }: { onStart: () => void }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-8 md:p-12 border border-gray-200">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-8 bg-blue-100 text-blue-600">
        <Icons.Code />
      </div>
      
      <h2 className="text-4xl font-bold text-gray-900 mb-4">
        Technical Assessment
      </h2>
      
      <div className="space-y-6 mb-10 text-lg text-gray-600">
        <p>
          This section consists of 45 multiple-choice questions designed to mimic the actual Accenture 2026 technical round patterns (Pseudocode, DSA, Core CS).
        </p>

        <div className="bg-red-50 p-6 rounded-lg border border-red-100 space-y-2 text-sm text-red-800">
            <p className="font-bold flex items-center gap-2"><Icons.Shield /> STRICT PROCTORING ENABLED</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>You must remain in <strong>Full Screen</strong> mode.</li>
                <li><strong>Do not switch tabs</strong> or minimize the window.</li>
                <li><strong>5 Violations</strong> will result in immediate termination.</li>
                <li>Right-click, Copy, and Paste are disabled.</li>
            </ul>
        </div>
        <ul className="space-y-3">
          <li className="flex items-center gap-3">
            <Icons.CheckCircle /> 
            <span className="font-medium text-gray-900">45 Minutes</span> total duration
          </li>
          <li className="flex items-center gap-3">
            <Icons.CheckCircle /> 
            <span className="font-medium text-gray-900">No Negative Marking</span>
          </li>
          <li className="flex items-center gap-3">
            <Icons.CheckCircle /> 
            Pass Criteria: 60%
          </li>
        </ul>
      </div>

      <Button onClick={onStart} className="w-full text-lg py-4">
        Agree & Start Test (Enter Full Screen)
      </Button>
    </div>
  </div>
);

const PlayScreen = ({ 
  mcqs, 
  answers, 
  flags, 
  skipped, 
  onAnswer, 
  onFlag, 
  onSkip, 
  onSubmit, 
  timeLeft
}: any) => {
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [warnings, setWarnings] = useState(0);
  const [showWarning, setShowWarning] = useState(false);
  const [violationReason, setViolationReason] = useState("");

  // Safety check
  if (!mcqs || mcqs.length === 0) return null;

  const enterFullScreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch (e) {
      console.warn("Full screen denied", e);
    }
  }, []);

  const handleViolation = useCallback((reason: string) => {
    if (showWarning) return; // Don't stack warnings
    
    const newCount = warnings + 1;
    setWarnings(newCount);
    setViolationReason(reason);
    
    if (newCount >= CONFIG.maxWarnings) {
      // Immediate termination
      onSubmit();
    } else {
      setShowWarning(true);
    }
  }, [warnings, showWarning, onSubmit]);

  // Proctoring Effect
  useEffect(() => {
    enterFullScreen();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation("Tab Switch / Window Minimized");
      }
    };

    const handleBlur = () => {
      handleViolation("Focus Lost (Clicked outside window)");
    };

    const handleFullScreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation("Exited Full Screen Mode");
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handleContextMenu = (e: Event) => e.preventDefault();
    const handleCopyPaste = (e: Event) => e.preventDefault();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("fullscreenchange", handleFullScreenChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleCopyPaste);
    document.addEventListener("cut", handleCopyPaste);
    document.addEventListener("paste", handleCopyPaste);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleCopyPaste);
      document.removeEventListener("cut", handleCopyPaste);
      document.removeEventListener("paste", handleCopyPaste);
    };
  }, [handleViolation, enterFullScreen]);

  const handleAcknowledgeWarning = async () => {
    setShowWarning(false);
    await enterFullScreen();
  };

  const q = mcqs[currentQIdx];
  const isAnswered = answers[q.id] !== undefined;
  const isFlagged = flags[q.id];
  const isSkipped = skipped[q.id];

  const handleSkip = () => {
    onSkip(q.id);
    if (currentQIdx < mcqs.length - 1) setCurrentQIdx(currentQIdx + 1);
  };

  return (
    <>
      {showWarning && (
        <ProctorWarningModal 
          warnings={warnings} 
          onAcknowledge={handleAcknowledgeWarning}
          onQuit={onSubmit}
          reason={violationReason}
        />
      )}
      
      <Layout 
        timeLeft={timeLeft} 
        title={`Question ${currentQIdx + 1}/${mcqs.length}`} 
        section="Technical Round"
        onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        <div className="h-full flex relative">
          {/* Sidebar - Question Palette */}
          <aside className={`absolute inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
            <div className="p-4 h-full flex flex-col">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Question Palette</h3>
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-4 gap-2">
                  {mcqs.map((m: any, idx: number) => {
                    const ans = answers[m.id] !== undefined;
                    const flag = flags[m.id];
                    const skip = skipped[m.id];
                    const current = idx === currentQIdx;

                    let classes = "h-10 w-10 rounded text-sm font-semibold transition-all ";
                    if (current) classes += "ring-2 ring-brand-purple ring-offset-2 ";
                    
                    if (flag) classes += "bg-yellow-100 text-yellow-700 border border-yellow-300";
                    else if (ans) classes += "bg-green-100 text-green-700 border border-green-300";
                    else if (skip) classes += "bg-gray-200 text-gray-500";
                    else classes += "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50";

                    return (
                      <button type="button" key={m.id} onClick={() => setCurrentQIdx(idx)} className={classes}>
                        {idx + 1}
                        {flag && <span className="absolute top-0 right-0 -mt-1 -mr-1 w-2 h-2 bg-yellow-500 rounded-full"></span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-green-100 border border-green-300 rounded"></div> Answered</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-yellow-100 border border-yellow-300 rounded"></div> Flagged</div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 bg-gray-200 rounded"></div> Skipped</div>
              </div>
            </div>
          </aside>

          {/* Main Question Area */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-6 md:p-12" onClick={() => isSidebarOpen && setIsSidebarOpen(false)}>
            <div className="max-w-3xl mx-auto pb-20">
              {/* Question Header */}
              <div className="flex items-start justify-between mb-8">
                <div className="space-y-2 w-full">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-bold text-brand-purple bg-purple-50 px-3 py-1 rounded-full uppercase tracking-wide">
                      {q.topic}
                    </span>
                    <span className={`text-sm font-medium px-2 py-0.5 rounded capitalize ${q.difficulty === 'hard' ? 'text-red-600 bg-red-50' : q.difficulty === 'medium' ? 'text-yellow-600 bg-yellow-50' : 'text-green-600 bg-green-50'}`}>
                      {q.difficulty}
                    </span>
                    {q.isRepeat && (
                      <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-100 border border-orange-200 px-2 py-1 rounded-full">
                        <span className="text-orange-500 text-sm">🔥</span> Previous Year Pattern
                      </span>
                    )}
                  </div>
                  <div className="text-xl md:text-2xl font-bold text-gray-900 leading-snug">
                    <FormattedText text={q.stem} />
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  onClick={() => onFlag(q.id)} 
                  className={`shrink-0 ml-4 ${isFlagged ? "text-yellow-500 bg-yellow-50" : ""}`}
                  icon={<Icons.Flag />}
                >
                  {isFlagged ? "Flagged" : "Flag"}
                </Button>
              </div>

              {/* Options */}
              <div className="space-y-4 mb-12">
                {q.options.map((opt: string, idx: number) => {
                  const selected = answers[q.id] === idx;
                  return (
                    <div 
                      key={idx}
                      onClick={() => onAnswer(q.id, idx)}
                      className={`
                        relative group cursor-pointer p-5 rounded-xl border-2 transition-all duration-200
                        ${selected 
                          ? 'border-brand-purple bg-purple-50 shadow-md' 
                          : 'border-gray-200 bg-white hover:border-brand-purple/50 hover:shadow-sm'
                        }
                      `}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border
                          ${selected ? 'bg-brand-purple text-white border-brand-purple' : 'bg-white text-gray-500 border-gray-300 group-hover:border-brand-purple'}
                        `}>
                          {String.fromCharCode(65 + idx)}
                        </div>
                        <span className={`text-lg ${selected ? 'text-brand-purple font-medium' : 'text-gray-700'}`}>
                          {opt}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-gray-200">
                <Button 
                  variant="secondary" 
                  onClick={() => setCurrentQIdx(Math.max(0, currentQIdx - 1))}
                  disabled={currentQIdx === 0}
                  icon={<Icons.ChevronLeft />}
                >
                  Previous
                </Button>

                <div className="flex gap-4 w-full sm:w-auto">
                  <Button 
                    variant="secondary"
                    onClick={handleSkip}
                    icon={<Icons.Skip />}
                    className="flex-1 sm:flex-none"
                  >
                    Skip
                  </Button>
                  
                  {currentQIdx === mcqs.length - 1 ? (
                    <Button 
                      onClick={onSubmit} 
                      className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-none"
                    >
                      Submit Assessment
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => setCurrentQIdx(currentQIdx + 1)} 
                      icon={<Icons.ChevronRight />}
                      className="flex-1 sm:flex-none"
                    >
                      Next
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
};

const ResultsScreen = ({ mcqs, answers, skipped, onRestart }: any) => {
  const techCorrect = Object.keys(answers).filter(id => answers[id] === mcqs.find((m: any) => m.id === id)?.correctIndex).length;
  const techScore = (techCorrect / (mcqs.length || 1)) * 100;
  const passed = techScore >= CONFIG.passPercent;

  // Categorized Stats
  const stats: Record<string, { total: number; correct: number }> = {};
  mcqs.forEach((q: any) => {
      const topic = q.topic || "General";
      if (!stats[topic]) stats[topic] = { total: 0, correct: 0 };
      stats[topic].total++;
      if (answers[q.id] === q.correctIndex) stats[topic].correct++;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="flex-1 py-12 px-4 md:px-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Technical Report</h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Session ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</span>
                <span>•</span>
                <span>{new Date().toLocaleDateString()}</span>
              </div>
            </div>
            <div className={`px-8 py-3 rounded-xl font-bold text-xl shadow-lg flex items-center gap-3 ${passed ? 'bg-green-600 text-white' : 'bg-white text-red-600 border border-red-100'}`}>
              {passed ? <Icons.CheckCircle /> : <Icons.AlertCircle />}
              {passed ? 'PASSED TECHNICAL ROUND' : 'DID NOT PASS'}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 text-brand-purple">
                <div className="transform scale-[2]"><Icons.Code /></div>
              </div>
              <h3 className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-6">Overall Score</h3>
              <div className="flex items-baseline gap-2 mb-6">
                <span className={`text-6xl font-black ${passed ? 'text-green-600' : 'text-red-500'}`}>
                  {Math.round(techScore)}%
                </span>
                <span className="text-gray-400 font-medium">/ 100%</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                  <div className="text-2xl font-bold text-green-700">{techCorrect}</div>
                  <div className="text-xs text-green-600 font-semibold uppercase">Correct</div>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-100">
                  <div className="text-2xl font-bold text-red-700">{mcqs.length - techCorrect}</div>
                  <div className="text-xs text-red-600 font-semibold uppercase">Incorrect</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="text-2xl font-bold text-gray-700">{Object.keys(skipped).filter(k => skipped[k]).length}</div>
                  <div className="text-xs text-gray-500 font-semibold uppercase">Skipped</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
               <h3 className="text-gray-500 font-bold uppercase tracking-wider text-sm mb-6">Topic Breakdown</h3>
               <div className="space-y-4">
                 {Object.entries(stats).map(([topic, data]) => (
                   <div key={topic} className="flex flex-col gap-1">
                     <div className="flex justify-between text-sm font-medium">
                       <span>{topic}</span>
                       <span>{Math.round((data.correct/data.total)*100)}%</span>
                     </div>
                     <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                       <div className="h-full bg-brand-purple" style={{ width: `${(data.correct/data.total)*100}%` }}></div>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-6">Detailed Solutions</h3>
          <div className="space-y-4">
            {mcqs.map((q: any, i: number) => {
              const ans = answers[q.id];
              const correct = ans === q.correctIndex;
              if (correct) return null;
              
              const isSkip = skipped[q.id];

              return (
                <div key={q.id} className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
                  <div className="flex gap-4">
                    <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${isSkip ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-600'}`}>
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {isSkip && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-bold uppercase">Skipped</span>}
                        <span className="text-xs font-bold text-brand-purple bg-purple-50 px-2 py-0.5 rounded uppercase">{q.topic}</span>
                        {q.isRepeat && <span className="text-xs font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded flex items-center gap-1">🔥 Prev. Year</span>}
                      </div>
                      <div className="font-medium text-gray-900 mb-3">
                         <FormattedText text={q.stem} />
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4 text-sm space-y-2">
                        <div className="flex gap-2">
                          <span className="font-bold text-red-500 min-w-[100px]">Your Answer:</span>
                          <span className="text-gray-600">{isSkip ? 'No answer selected' : q.options[ans]}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="font-bold text-green-600 min-w-[100px]">Correct:</span>
                          <span className="text-gray-900">{q.options[q.correctIndex]}</span>
                        </div>
                        <div className="pt-2 mt-2 border-t border-gray-200 text-gray-500 italic">
                          "{q.explanation}"
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center pb-12">
            <Button onClick={onRestart} size="lg">Start New Simulator</Button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};


// --- Main App Component ---

const App = () => {
  const [state, setState] = useState<AppState>({
    screen: 'landing',
    loadingMessage: '',
    mcqs: [],
    mcqAnswers: {},
    mcqFlags: {},
    mcqSkipped: {},
    timeLeft: 0,
    apiKey: DEFAULT_API_KEY
  });

  // Global Timer logic inside App
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (state.screen === 'play' && state.timeLeft > 0) {
      interval = setInterval(() => {
        setState(prev => {
          if (prev.timeLeft <= 1) {
            return { ...prev, timeLeft: 0, screen: 'results' };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [state.screen]);

  const startAssessment = async () => {
    setState(s => ({ ...s, screen: 'loading', loadingMessage: 'Generating Accenture Technical Patterns...' }));
    
    // Attempt to generate real content
    try {
      if (!state.apiKey) throw new Error("No API Key");
      
      const { mcqs } = await generateAssessmentContent(state.apiKey);
      setState(s => ({ ...s, mcqs, screen: 'instructions' }));
      
    } catch (e) {
      console.error("API Error:", e);
      alert("Failed to generate questions. Please ensure your API Key is valid and has quota.");
      setState(s => ({ ...s, screen: 'landing' }));
    }
  };

  const beginTechnical = () => {
    setState(s => ({ 
      ...s, 
      screen: 'play', 
      timeLeft: CONFIG.totalTime,
      mcqAnswers: {},
      mcqFlags: {},
      mcqSkipped: {}
    }));
  };

  const submitTechnical = useCallback(() => {
    // Exit full screen if active
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.log(e));
    }
    setState(s => ({ ...s, screen: 'results' }));
  }, []);

  const handleAnswer = (qId: string, optIdx: number) => {
    setState(s => ({
      ...s,
      mcqAnswers: { ...s.mcqAnswers, [qId]: optIdx },
      mcqSkipped: { ...s.mcqSkipped, [qId]: false }
    }));
  };

  const handleFlag = (qId: string) => {
    setState(s => ({
      ...s,
      mcqFlags: { ...s.mcqFlags, [qId]: !s.mcqFlags[qId] }
    }));
  };

  const handleSkip = (qId: string) => {
    setState(s => {
      const newAns = { ...s.mcqAnswers };
      delete newAns[qId];
      return {
        ...s,
        mcqAnswers: newAns,
        mcqSkipped: { ...s.mcqSkipped, [qId]: true }
      };
    });
  };

  const handleRestart = () => {
    setState(s => ({
      ...s,
      screen: 'landing',
      loadingMessage: '',
      mcqs: [],
      mcqAnswers: {},
      mcqFlags: {},
      mcqSkipped: {},
      timeLeft: 0
    }));
  };

  return (
    <>
      {state.screen === 'landing' && <LandingScreen onStart={startAssessment} />}
      {state.screen === 'loading' && <LoadingScreen message={state.loadingMessage} />}
      {state.screen === 'instructions' && <InstructionsScreen onStart={beginTechnical} />}
      {state.screen === 'play' && (
        <PlayScreen 
          mcqs={state.mcqs}
          answers={state.mcqAnswers}
          flags={state.mcqFlags}
          skipped={state.mcqSkipped}
          timeLeft={state.timeLeft}
          onAnswer={handleAnswer}
          onFlag={handleFlag}
          onSkip={handleSkip}
          onSubmit={submitTechnical}
        />
      )}
      {state.screen === 'results' && (
        <ResultsScreen 
          mcqs={state.mcqs}
          answers={state.mcqAnswers}
          skipped={state.mcqSkipped}
          onRestart={handleRestart}
        />
      )}
    </>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
