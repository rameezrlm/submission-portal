import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { SubmissionForm, SubmissionData } from './components/SubmissionForm';
import { SuccessView } from './components/SuccessView';
import { AppsScriptModal } from './components/AppsScriptModal';

const DEFAULT_FOLDER_ID = '1IewvX8KRtt0nmRp7ZV8X8D_J_tkZn2uiL';

export default function App() {
  const [folderId, setFolderId] = useState<string>(DEFAULT_FOLDER_ID);
  const [scriptUrl, setScriptUrl] = useState<string>(() => {
    return (
      localStorage.getItem('student_portal_apps_script_url') ||
      import.meta.env.VITE_GOOGLE_APPS_SCRIPT_URL ||
      'https://script.google.com/macros/s/AKfycbwMcAGqZcecU1coJ-jG0RffGEbY6TJmWmwqB2AkSNBqrWI3gfu_P0QRVA4FX84Cs4gH/exec'
    );
  });
  const [submittedData, setSubmittedData] = useState<SubmissionData | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);

  // Load backend configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          if (data.folderId) {
            setFolderId(data.folderId);
          }
          if (data.scriptUrl && !localStorage.getItem('student_portal_apps_script_url')) {
            setScriptUrl(data.scriptUrl);
          }
        }
      } catch (err) {
        console.warn('Could not fetch server config:', err);
      }
    };
    fetchConfig();
  }, []);

  const handleSaveScriptUrl = async (newUrl: string) => {
    setScriptUrl(newUrl);
    localStorage.setItem('student_portal_apps_script_url', newUrl);

    try {
      await fetch('/api/config/script-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptUrl: newUrl }),
      });
    } catch (err) {
      console.warn('Could not persist script URL to server:', err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <Header />

      {/* Main Container - Clean & Minimal */}
      <main className="flex-1 max-w-xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col justify-start">
        {submittedData ? (
          <SuccessView
            data={submittedData}
            onReset={() => setSubmittedData(null)}
          />
        ) : (
          <SubmissionForm
            folderId={folderId}
            scriptUrl={scriptUrl}
            onSuccess={(data) => setSubmittedData(data)}
            onOpenSetup={() => setIsSetupOpen(true)}
            onSaveScriptUrl={handleSaveScriptUrl}
          />
        )}
      </main>

      {/* Backend Setup Modal */}
      <AppsScriptModal
        isOpen={isSetupOpen}
        onClose={() => setIsSetupOpen(false)}
        folderId={folderId}
        scriptUrl={scriptUrl}
        onSaveScriptUrl={handleSaveScriptUrl}
      />
    </div>
  );
}
