import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  FileCheck2,
  FileSpreadsheet,
  FileImage,
  FileArchive,
  Presentation,
  File,
  X,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  processAndCompressFile,
  fileToBase64,
  SUPPORTED_EXTENSIONS,
  CompressionResult,
} from '../utils/fileCompressor';
import { generateTargetFilename, formatBytes } from '../utils/filenameHelper';

export interface SubmissionData {
  studentName: string;
  originalFilename: string;
  targetFilename: string;
  fileSize: number;
  compressedSize?: number;
  fileId?: string;
  fileUrl?: string;
  timestamp: string;
  folderId: string;
  folderUrl: string;
  simulated?: boolean;
}

interface SubmissionFormProps {
  folderId: string;
  scriptUrl: string;
  onSuccess: (data: SubmissionData) => void;
  onOpenSetup: () => void;
  onSaveScriptUrl?: (url: string) => void;
}

export const SubmissionForm: React.FC<SubmissionFormProps> = ({
  folderId,
  scriptUrl,
  onSuccess,
  onOpenSetup,
}) => {
  const [studentName, setStudentName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derive target filename preview
  const filenamePreview = selectedFile
    ? generateTargetFilename(selectedFile.name, studentName || 'Student').targetFilename
    : null;

  const handleFileChange = async (file: File) => {
    setErrorMessage(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_EXTENSIONS.includes(ext as any)) {
      setErrorMessage(
        `Unsupported format ".${ext || 'unknown'}". Allowed: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, JPG, PNG, ZIP.`
      );
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 50 MB limit.');
      return;
    }

    setSelectedFile(file);
    setIsCompressing(true);
    setUploadStatus('Optimizing...');

    try {
      const result = await processAndCompressFile(file, (msg) => {
        setUploadStatus(msg);
      });
      setCompressionResult(result);
    } catch {
      setCompressionResult({
        file,
        originalSize: file.size,
        compressedSize: file.size,
        compressionRatio: 0,
        wasCompressed: false,
        type: file.type,
      });
    } finally {
      setIsCompressing(false);
      setUploadStatus('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setCompressionResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = studentName.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter your full name.');
      return;
    }

    if (!selectedFile) {
      setErrorMessage('Please choose a file to submit.');
      return;
    }

    const activeScriptUrl = scriptUrl.trim();
    if (!activeScriptUrl) {
      setErrorMessage('Backend URL is not configured. Please open Settings.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(15);
    setUploadStatus('Uploading...');

    try {
      const fileToUpload = compressionResult?.file || selectedFile;
      const base64Data = await fileToBase64(fileToUpload);

      setUploadProgress(40);

      const progressTimer = setInterval(() => {
        setUploadProgress((prev) => (prev < 85 ? prev + 8 : prev));
      }, 300);

      let uploadResult: any = null;

      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: trimmedName,
            filename: selectedFile.name,
            fileData: base64Data,
            mimeType: fileToUpload.type || 'application/octet-stream',
            folderId,
            scriptUrl: activeScriptUrl,
          }),
        });

        clearInterval(progressTimer);
        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.status === 'error') {
          throw new Error(data.message || 'Upload failed.');
        }

        uploadResult = data;
      } catch (proxyError: any) {
        clearInterval(progressTimer);

        // Fallback: Direct POST to script if proxy had network issue
        if (activeScriptUrl.startsWith('https://script.google.com/')) {
          const directResp = await fetch(activeScriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              studentName: trimmedName,
              filename: selectedFile.name,
              fileData: base64Data,
              mimeType: fileToUpload.type || 'application/octet-stream',
              folderId,
            }),
          });
          const directData = await directResp.json();
          if (directData.status === 'error') {
            throw new Error(directData.message || 'Upload error.');
          }
          uploadResult = directData;
        } else {
          throw proxyError;
        }
      }

      setUploadProgress(100);
      setUploadStatus('Done!');

      const finalFilename =
        uploadResult.filename ||
        generateTargetFilename(selectedFile.name, trimmedName).targetFilename;

      setTimeout(() => {
        setIsUploading(false);
        onSuccess({
          studentName: trimmedName,
          originalFilename: selectedFile.name,
          targetFilename: finalFilename,
          fileSize: selectedFile.size,
          compressedSize: compressionResult?.wasCompressed
            ? compressionResult.compressedSize
            : undefined,
          fileId: uploadResult.fileId,
          fileUrl: uploadResult.fileUrl,
          timestamp: uploadResult.timestamp || new Date().toISOString(),
          folderId: uploadResult.folderId || folderId,
          folderUrl: `https://drive.google.com/drive/folders/${uploadResult.folderId || folderId}`,
        });
      }, 300);
    } catch (err: any) {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStatus('');
      setErrorMessage(err.message || 'Upload failed. Please check connection and try again.');
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return <FileText className="w-6 h-6 text-rose-600" />;
      case 'doc':
      case 'docx':
        return <FileCheck2 className="w-6 h-6 text-blue-600" />;
      case 'xls':
      case 'xlsx':
        return <FileSpreadsheet className="w-6 h-6 text-emerald-600" />;
      case 'ppt':
      case 'pptx':
        return <Presentation className="w-6 h-6 text-amber-600" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
        return <FileImage className="w-6 h-6 text-purple-600" />;
      case 'zip':
        return <FileArchive className="w-6 h-6 text-yellow-700" />;
      default:
        return <File className="w-6 h-6 text-slate-500" />;
    }
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Minimal Tech Labs Blue Top Line */}
        <div className="h-1.5 bg-[#1B4B8A] w-full" />

        <div className="p-6 sm:p-7">
          <h2 className="text-xl font-semibold text-slate-900">
            Submit Assignment
          </h2>

          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            {/* Error Message */}
            {errorMessage && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{errorMessage}</div>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="text-rose-500 hover:text-rose-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Student Full Name */}
            <div>
              <label
                htmlFor="studentName"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Full Name
              </label>
              <input
                id="studentName"
                type="text"
                required
                disabled={isUploading}
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1B4B8A]/20 focus:border-[#1B4B8A] transition-colors disabled:bg-slate-50"
              />
            </div>

            {/* File Dropzone / Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Attachment
              </label>

              {!selectedFile ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                    isDragging
                      ? 'border-[#1B4B8A] bg-blue-50/40'
                      : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.zip"
                  />
                  <UploadCloud className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs text-slate-700">
                    <span className="font-medium text-[#1B4B8A]">Choose file</span> or drag &amp; drop
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, JPG, PNG, ZIP
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 p-3.5 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {getFileIcon(selectedFile.name)}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-900 truncate">
                          {selectedFile.name}
                        </p>
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                          <span>{formatBytes(selectedFile.size)}</span>
                          {compressionResult?.wasCompressed && (
                            <>
                              <span>·</span>
                              <span className="text-[#1B4B8A] font-medium inline-flex items-center gap-0.5">
                                <Sparkles className="w-3 h-3 text-[#2563EB]" />
                                {formatBytes(compressionResult.compressedSize)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!isUploading && (
                      <button
                        type="button"
                        onClick={handleClearFile}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded"
                        title="Remove file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {filenamePreview && (
                    <p className="text-[11px] text-slate-500 truncate pt-1 border-t border-slate-200/60 font-mono">
                      Saved as: {filenamePreview}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {isUploading && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>{uploadStatus || 'Uploading...'}</span>
                  <span className="font-mono">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#1B4B8A] h-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isUploading || isCompressing || !selectedFile || !studentName.trim()}
                className="w-full py-2.5 px-4 bg-[#1B4B8A] hover:bg-[#153a6b] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-2xs"
              >
                {isUploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Turn In</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
