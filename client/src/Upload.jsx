import { useState, useRef } from 'react';
import './Upload.css';

/**
 * Upload Component
 * @param {Object} props
 * @param {Function} props.onUploadSuccess - Callback when file uploads successfully, takes fileId
 * @param {Function} props.onNavigate - Navigation helper to route to different paths
 */
function Upload({ onUploadSuccess, onNavigate }) {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const fileInputRef = useRef(null);

  // Helper to format bytes to human-readable size
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Validate selected file
  const validateAndSetFile = (selectedFile) => {
    setError('');
    if (!selectedFile) return;

    // Check extension (.fbx)
    const fileName = selectedFile.name;
    const isFbx = fileName.toLowerCase().endsWith('.fbx');
    if (!isFbx) {
      setError('Invalid file type. Only .fbx files are allowed.');
      setFile(null);
      return;
    }

    // Check size (Max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > maxSize) {
      setError('File is too large. Maximum size allowed is 50MB.');
      setFile(null);
      return;
    }

    setFile(selectedFile);
  };

  // Drag handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current.click();
  };

  const handleRemoveFile = () => {
    setFile(null);
    setProgress(0);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload file using XMLHttpRequest to track progress accurately
  const handleUpload = () => {
    if (!file) return;

    setUploading(true);
    setProgress(0);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        const percentCompleted = Math.round((event.loaded * 100) / event.total);
        setProgress(percentCompleted);
      }
    });

    // Handle complete / success
    xhr.addEventListener('load', () => {
      setUploading(false);
      
      let fileId = null;
      let errorMsg = 'Upload failed. Please try again.';
      try {
        const response = JSON.parse(xhr.responseText);
        fileId = response.fileId;
        if (response.error) {
          errorMsg = response.error;
        }
      } catch {
        // Keep default error state
      }

      if (xhr.status >= 200 && xhr.status < 300 && fileId) {
        // Save fileId to state and navigate to /editor/{fileId}
        onUploadSuccess(fileId);
        onNavigate(`/editor/${fileId}`);
      } else {
        setError(errorMsg);
      }
    });

    // Handle errors
    xhr.addEventListener('error', () => {
      setUploading(false);
      setError('A network error occurred during upload. Please check your connection.');
    });

    xhr.addEventListener('abort', () => {
      setUploading(false);
      setError('Upload cancelled.');
    });

    xhr.open('POST', '/api/upload');
    xhr.send(formData);
  };

  return (
    <div className="upload-container">
      <div className="upload-header">
        <h1>Upload 3D Asset</h1>
        <p className="upload-subtitle">Upload your FBX model to scale, center, and optimize it.</p>
      </div>

      <div 
        className={`dropzone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          id="fbx-file-input" 
          className="file-input-hidden" 
          accept=".fbx"
          onChange={handleChange}
          disabled={uploading}
        />

        {!file ? (
          <div className="dropzone-content" onClick={handleButtonClick}>
            <div className="upload-icon-container">
              <svg className="upload-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <h3>Drag & drop your FBX file here</h3>
            <p>or <span className="browse-link">browse your files</span></p>
            <span className="file-limits">FBX format only • Max 50MB</span>
          </div>
        ) : (
          <div className="file-details-container">
            <div className="file-info-card">
              <div className="file-icon-box">
                <svg className="fbx-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="file-metadata">
                <h4 className="file-name">{file.name}</h4>
                <p className="file-size">{formatBytes(file.size)}</p>
              </div>
              {!uploading && (
                <button type="button" className="remove-file-btn" onClick={handleRemoveFile} title="Remove file">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {uploading && (
              <div className="progress-section">
                <div className="progress-bar-wrapper">
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="progress-text-row">
                  <span className="progress-status">Uploading model...</span>
                  <span className="progress-percent">{progress}%</span>
                </div>
              </div>
            )}

            {!uploading && (
              <button 
                type="button" 
                className="action-btn upload-btn" 
                onClick={handleUpload}
              >
                Upload & Process
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-alert">
          <svg className="error-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span className="error-message">{error}</span>
        </div>
      )}
    </div>
  );
}

export default Upload;
