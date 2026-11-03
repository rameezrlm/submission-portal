import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Play,
  Save,
  HelpCircle,
  FileCode,
  ShieldAlert,
  Server,
  FolderLock,
} from 'lucide-react';

interface AppsScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: string;
  scriptUrl: string;
  onSaveScriptUrl: (url: string) => void;
}

export const AppsScriptModal: React.FC<AppsScriptModalProps> = ({
  isOpen,
  onClose,
  folderId,
  scriptUrl,
  onSaveScriptUrl,
}) => {
  const [copied, setCopied] = useState(false);
  const [localUrl, setLocalUrl] = useState(scriptUrl);
  const [testResult, setTestResult] = useState<{
    status: 'idle' | 'testing' | 'success' | 'error';
    message?: string;
  }>({ status: 'idle' });

  if (!isOpen) return null;

  const appsScriptCode = `/**
 * =========================================================================
 * Student Submission Portal - Resilient Google Apps Script Backend
 * Target Google Drive Folder ID: ${folderId}
 * =========================================================================
 */

var DEFAULT_FOLDER_ID = "${folderId}";

function cleanFolderId(input) {
  if (!input) return DEFAULT_FOLDER_ID;
  var str = ("" + input).trim();
  var match = str.match(/folders\\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) return match[1];
  var idMatch = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) return idMatch[1];
  return str.replace(/https?:\\/\\/[^/]+\\//, "").replace(/\\//g, "").trim();
}

function getTargetFolder(rawFolderId) {
  var cleanId = cleanFolderId(rawFolderId || DEFAULT_FOLDER_ID);
  var effectiveEmail = "";
  try {
    effectiveEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {}

  try {
    var folder = DriveApp.getFolderById(cleanId);
    return {
      folder: folder,
      folderId: cleanId,
      folderName: folder.getName(),
      fallback: false,
      effectiveEmail: effectiveEmail
    };
  } catch (err) {
    // Fallback: If folder ID is not accessible to this account, save into "Student Submissions"
    var folderName = "Student Submissions";
    var existing = DriveApp.getFoldersByName(folderName);
    var fallbackFolder = existing.hasNext() ? existing.next() : DriveApp.createFolder(folderName);

    return {
      folder: fallbackFolder,
      folderId: fallbackFolder.getId(),
      folderName: fallbackFolder.getName(),
      fallback: true,
      requestedFolderId: cleanId,
      effectiveEmail: effectiveEmail,
      warning: "Target folder ID (" + cleanId + ") was not accessible to account [" + (effectiveEmail || "current user") + "]. Upload was safely saved in folder '" + folderName + "'."
    };
  }
}

function doGet(e) {
  try {
    var folderResult = getTargetFolder(e && e.parameter ? e.parameter.folderId : DEFAULT_FOLDER_ID);
    return ContentService.createTextOutput(JSON.stringify({
      status: "ready",
      message: folderResult.fallback
        ? folderResult.warning
        : "Student Submission Portal backend is active and connected to Drive.",
      folderId: folderResult.folderId,
      folderName: folderResult.folderName,
      fallbackUsed: folderResult.fallback,
      effectiveEmail: folderResult.effectiveEmail,
      targetFolderId: DEFAULT_FOLDER_ID,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Folder access error: " + err.toString(),
      targetFolderId: DEFAULT_FOLDER_ID
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    if (!e || (!e.postData && !e.parameter)) {
      throw new Error("No data received in POST request.");
    }

    var payload = {};
    if (e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (jsonErr) {
        payload = e.parameter || {};
      }
    } else if (e.parameter) {
      payload = e.parameter;
    }

    var studentName = (payload.studentName || payload.name || "").trim();
    var originalFilename = (payload.filename || payload.fileName || "submission").trim();
    var base64Data = payload.fileData || payload.base64 || "";
    var mimeType = payload.mimeType || "application/octet-stream";
    var requestedFolderId = payload.folderId || DEFAULT_FOLDER_ID;

    if (!studentName) throw new Error("Student Full Name is required.");
    if (!base64Data) throw new Error("No file content received.");

    if (base64Data.indexOf("base64,") !== -1) {
      base64Data = base64Data.split("base64,")[1];
    }

    var cleanStudentName = studentName
      .replace(/[\\\\/:*?"<>|#%&{}\\\\$!'@+\`=]/g, "")
      .replace(/\\s+/g, "_")
      .trim();

    if (!cleanStudentName) cleanStudentName = "Student";

    var lastDotIndex = originalFilename.lastIndexOf(".");
    var baseName = originalFilename;
    var extension = "";
    if (lastDotIndex > 0) {
      baseName = originalFilename.substring(0, lastDotIndex);
      extension = originalFilename.substring(lastDotIndex);
    }

    var cleanBaseName = baseName.replace(/[\\\\/:*?"<>|]/g, "_").trim();
    var targetFilename = cleanBaseName + "_" + cleanStudentName + extension;

    var folderResult = getTargetFolder(requestedFolderId);
    var folder = folderResult.folder;

    var existingFiles = folder.getFilesByName(targetFilename);
    if (existingFiles.hasNext()) {
      var timeFormatted = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "UTC", "yyyyMMdd_HHmmss");
      targetFilename = cleanBaseName + "_" + cleanStudentName + "_" + timeFormatted + extension;
    }

    var decodedBytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedBytes, mimeType, targetFilename);
    var createdFile = folder.createFile(blob);

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: folderResult.fallback
        ? "File uploaded to Drive in folder '" + folderResult.folderName + "'. (" + folderResult.warning + ")"
        : "File successfully uploaded and saved to Google Drive.",
      fileId: createdFile.getId(),
      filename: targetFilename,
      originalFilename: originalFilename,
      studentName: studentName,
      fileSize: createdFile.getSize(),
      fileUrl: createdFile.getUrl(),
      folderId: folderResult.folderId,
      folderName: folderResult.folderName,
      fallbackUsed: folderResult.fallback,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.message || err.toString(),
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSaveScriptUrl(localUrl.trim());
    setTestResult({
      status: 'idle',
      message: 'Web App URL saved successfully.',
    });
  };

  const handleTestConnection = async () => {
    const urlToTest = localUrl.trim();
    if (!urlToTest) {
      setTestResult({
        status: 'error',
        message: 'Please paste your Google Apps Script Web App URL first.',
      });
      return;
    }

    setTestResult({ status: 'testing' });
    try {
      const res = await fetch('/api/test-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptUrl: urlToTest }),
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        setTestResult({
          status: 'success',
          message: 'Connection verified! Your Google Apps Script backend is online and reachable.',
        });
      } else {
        setTestResult({
          status: 'error',
          message: data.message || 'Could not reach endpoint. Verify that "Who has access" is set to "Anyone".',
        });
      }
    } catch (err: any) {
      setTestResult({
        status: 'error',
        message: `Connection failed: ${err.message || 'Network error'}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-slate-200 shadow-xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#1B4B8A] text-white flex items-center justify-center">
              <FileCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Backend Settings
              </h3>
              <p className="text-xs text-slate-500">
                Google Apps Script Web App
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Target Folder Link Box */}
          <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <FolderLock className="w-5 h-5 text-[#137333] shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-950">
                  Target Google Drive Folder
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Submissions are uploaded directly here
                </p>
              </div>
            </div>
            <a
              href={`https://drive.google.com/drive/folders/${folderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#137333] hover:text-[#0f5c29] bg-white border border-emerald-200 px-3 py-1.5 rounded-md shadow-2xs hover:bg-emerald-50 transition-colors"
            >
              <span>Open in Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Web App URL Configuration */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-900">
              Deployed Web App URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={localUrl}
                onChange={(e) => setLocalUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#137333]/20 focus:border-[#137333]"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save URL</span>
                </button>
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testResult.status === 'testing'}
                  className="px-4 py-2.5 bg-emerald-50 text-[#137333] hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
                >
                  {testResult.status === 'testing' ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#137333] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>Test Connection</span>
                </button>
              </div>
            </div>

            {testResult.message && (
              <p
                className={`text-xs mt-1.5 flex items-center gap-1.5 ${
                  testResult.status === 'success'
                    ? 'text-emerald-700 font-medium'
                    : testResult.status === 'error'
                    ? 'text-rose-600'
                    : 'text-slate-600'
                }`}
              >
                {testResult.status === 'success' && <Check className="w-3.5 h-3.5" />}
                {testResult.message}
              </p>
            )}
          </div>

          {/* 4-Step Instructions */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quick 4-Step Deployment Guide
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <span className="font-semibold text-slate-900 block mb-1">1. Create Project</span>
                <p className="text-slate-600 leading-relaxed">
                  Go to <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-[#137333] hover:underline font-medium">script.google.com</a> and click <strong>+ New project</strong>.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <span className="font-semibold text-slate-900 block mb-1">2. Paste Code</span>
                <p className="text-slate-600 leading-relaxed">
                  Replace all content in <code className="bg-slate-200 px-1 py-0.5 rounded">Code.gs</code> with the code below and save (Ctrl+S).
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <span className="font-semibold text-slate-900 block mb-1">3. Deploy as Web App</span>
                <p className="text-slate-600 leading-relaxed">
                  Click <strong>Deploy &gt; New deployment</strong>. Select <strong>Web app</strong>. Execute as: <strong>Me</strong>. Who has access: <strong>Anyone</strong>.
                </p>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/70">
                <span className="font-semibold text-slate-900 block mb-1">4. Authorize & Paste URL</span>
                <p className="text-slate-600 leading-relaxed">
                  Authorize Drive permissions, copy the URL ending in <code className="bg-slate-200 px-1 py-0.5 rounded">/exec</code>, and paste it above.
                </p>
              </div>
            </div>
          </div>

          {/* Apps Script Code View */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Backend Script (<code className="font-mono text-emerald-800">Code.gs</code>)
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <pre className="text-[11px] font-mono leading-relaxed bg-slate-950 text-slate-200 p-4 rounded-xl overflow-x-auto max-h-64 border border-slate-800">
                {appsScriptCode}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-medium rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
