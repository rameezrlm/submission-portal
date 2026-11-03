import React from 'react';
import { CheckCircle2, ExternalLink, RotateCcw } from 'lucide-react';
import { SubmissionData } from './SubmissionForm';
import { formatBytes } from '../utils/filenameHelper';

interface SuccessViewProps {
  data: SubmissionData;
  onReset: () => void;
}

export const SuccessView: React.FC<SuccessViewProps> = ({ data, onReset }) => {
  const formattedDate = new Date(data.timestamp).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="w-full">
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Minimal Tech Labs Blue Accent Line */}
        <div className="h-1.5 bg-[#1B4B8A] w-full" />

        <div className="p-6 sm:p-7 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <img
              src="/assets/aistudio/image_32a8bc33.png"
              alt="Tech Labs"
              className="w-10 h-10 object-contain"
            />
            <div className="w-8 h-8 bg-blue-50 text-[#1B4B8A] rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Assignment Turned In
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Your submission has been received.
          </p>

          {/* Clean Minimal Summary */}
          <div className="mt-6 border border-slate-200 rounded-lg text-left divide-y divide-slate-100 text-xs">
            <div className="p-3 flex justify-between gap-2">
              <span className="text-slate-500">Student</span>
              <span className="font-medium text-slate-900">{data.studentName}</span>
            </div>

            <div className="p-3 flex justify-between gap-2">
              <span className="text-slate-500">File</span>
              <span className="font-mono text-slate-900 font-medium truncate max-w-[240px]">
                {data.targetFilename}
              </span>
            </div>

            <div className="p-3 flex justify-between gap-2">
              <span className="text-slate-500">Size</span>
              <span className="text-slate-700">
                {formatBytes(data.compressedSize || data.fileSize)}
              </span>
            </div>

            <div className="p-3 flex justify-between gap-2">
              <span className="text-slate-500">Time</span>
              <span className="text-slate-700">{formattedDate}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row gap-2.5 justify-center">
            {data.fileUrl && (
              <a
                href={data.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-slate-300 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-medium transition-colors"
              >
                <span>View in Drive</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            )}

            <button
              onClick={onReset}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1B4B8A] hover:bg-[#153a6b] text-white rounded-lg text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Submit Another File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
