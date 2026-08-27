'use client';

import { useState, useRef } from 'react';
import { Upload, CheckCircle, AlertCircle, Loader2, X } from 'lucide-react';

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  message: string;
  preview: string | null;
}

export default function ReceiptUpload({
  onUploaded,
}: {
  onUploaded?: (items: any[]) => void;
}) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    message: '',
    preview: null,
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024;

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: 'Only JPEG, PNG, and WebP images are allowed' };
    }
    if (file.size > MAX_SIZE) {
      return { valid: false, error: 'File size must be less than 5MB' };
    }
    return { valid: true };
  };

  const handleFile = async (file: File) => {
    const validation = validateFile(file);
    if (!validation.valid) {
      setUploadState({
        status: 'error',
        progress: 0,
        message: validation.error || 'Invalid file',
        preview: null,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadState((prev) => ({
        ...prev,
        preview: e.target?.result as string,
      }));
    };
    reader.readAsDataURL(file);

    await uploadReceipt(file);
  };

  const uploadReceipt = async (file: File) => {
    setUploadState({
      status: 'uploading',
      progress: 0,
      message: 'Extracting receipt data...',
      preview: uploadState.preview,
    });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const progressInterval = setInterval(() => {
        setUploadState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 20, 90),
        }));
      }, 200);

      const response = await fetch('/api/extract-receipt', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        throw new Error('Failed to extract receipt data');
      }

      const data = await response.json();

      if (!data.success || !data.items) {
        throw new Error(data.error || 'No items found in receipt');
      }

      setUploadState({
        status: 'success',
        progress: 100,
        message: `Found ${data.items.length} items in receipt`,
        preview: uploadState.preview,
      });

      if (onUploaded) {
        setTimeout(() => {
          onUploaded(data.items);
        }, 500);
      }
    } catch (error) {
      setUploadState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : 'Upload failed',
        preview: uploadState.preview,
      });
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleReset = () => {
    setUploadState({
      status: 'idle',
      progress: 0,
      message: '',
      preview: null,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full space-y-6">
      {uploadState.preview && (
        <div className="flex justify-between items-start gap-6">
          <div className="flex-1">
            <img
              src={uploadState.preview}
              alt="Receipt preview"
              className="w-full max-h-96 object-contain rounded-lg border border-gray-200"
            />
          </div>

          <div className="flex-1 space-y-4">
            {uploadState.status === 'uploading' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  <span className="text-sm font-medium">{uploadState.message}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${uploadState.progress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadState.status === 'success' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-lg p-4">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-900">{uploadState.message}</p>
                    <p className="text-sm text-green-700 mt-1">Proceeding to item selection...</p>
                  </div>
                </div>
              </div>
            )}

            {uploadState.status === 'error' && (
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Error</p>
                    <p className="text-sm text-red-700 mt-1">{uploadState.message}</p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          <button
            onClick={handleReset}
            className="flex-shrink-0 p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      )}

      {!uploadState.preview && (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition ${
            isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="space-y-3">
            <div className="flex justify-center">
              <Upload className="w-12 h-12 text-gray-400" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                Drag receipt here or{' '}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  browse
                </button>
              </p>
              <p className="text-sm text-gray-500 mt-1">
                JPEG, PNG, or WebP • Up to 5MB
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}