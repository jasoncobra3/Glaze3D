import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import './Editor.css';

function Editor() {
  const { fileId } = useParams();
  const navigate = useNavigate();

  // Scale state
  const [scaleX, setScaleX] = useState(1.0);
  const [scaleY, setScaleY] = useState(1.0);
  const [scaleZ, setScaleZ] = useState(1.0);

  // Position state
  const [posX, setPosX] = useState(0.0);
  const [posY, setPosY] = useState(0.0);
  const [posZ, setPosZ] = useState(0.0);

  // Mesh Operations state
  const [subdivide, setSubdivide] = useState(0);
  const [unsubdivide, setUnsubdivide] = useState(0);
  const [autoNormalize, setAutoNormalize] = useState(false);
  const [proceduralAnim, setProceduralAnim] = useState('none');

  // Status states
  const [processing, setProcessing] = useState(false);
  const [isProcessed, setIsProcessed] = useState(false);
  const [error, setError] = useState('');
  const [cacheBuster, setCacheBuster] = useState(0);

  // Material properties state
  const [color, setColor] = useState('#ffffff');
  const [metallic, setMetallic] = useState(0.0);
  const [roughness, setRoughness] = useState(0.5);
  const [transmission, setTransmission] = useState(0.0);

  // Lighting state
  const [environment, setEnvironment] = useState('neutral');
  
  // AR state
  const [showQR, setShowQR] = useState(false);
  // Note: if testing locally from a mobile device, access via the local network IP
  const arUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/ar/${fileId}`;

  // Animation state
  const modelRef = useRef(null);
  const [animations, setAnimations] = useState([]);
  const [currentAnimation, setCurrentAnimation] = useState('');
  const [isPlaying, setIsPlaying] = useState(true);

  // When model finishes loading or after processing, check for animations
  useEffect(() => {
    const viewer = modelRef.current;
    if (!viewer) return;

    const handleLoad = () => {
      // Small timeout to ensure DOM properties are populated
      setTimeout(() => {
        const availableAnimations = viewer.availableAnimations || [];
        setAnimations(availableAnimations);
        if (availableAnimations.length > 0) {
          setCurrentAnimation(availableAnimations[0]);
        } else {
          setCurrentAnimation('');
        }
      }, 100);
    };

    viewer.addEventListener('load', handleLoad);
    return () => viewer.removeEventListener('load', handleLoad);
  }, [isProcessed, cacheBuster]);

  // Handle play/pause toggle
  useEffect(() => {
    const viewer = modelRef.current;
    if (!viewer) return;
    
    // Check if the method exists
    if (typeof viewer.play === 'function') {
      if (isPlaying) {
        viewer.play();
      } else {
        viewer.pause();
      }
    }
  }, [isPlaying, currentAnimation, animations]);

  const ENVIRONMENTS = [
    { label: 'Neutral (Default)', value: 'neutral' },
    { label: 'Legacy (Flat)', value: 'legacy' },
    { label: 'Studio', value: 'https://modelviewer.dev/shared-assets/environments/aircraft_workshop_01_1k.hdr' },
    { label: 'Sunset', value: 'https://modelviewer.dev/shared-assets/environments/spruit_sunrise_1k_HDR.hdr' },
    { label: 'Forest', value: 'https://modelviewer.dev/shared-assets/environments/whipple_creek_regional_park_04_1k.hdr' },
  ];

  const handleProcessModel = async () => {
    setProcessing(true);
    setError('');
    setIsProcessed(false);

    const hex = color.replace('#','');
    const r = parseInt(hex.substring(0,2),16) / 255;
    const g = parseInt(hex.substring(2,4),16) / 255;
    const b = parseInt(hex.substring(4,6),16) / 255;
    const rgb = [r, g, b];
    console.log("Sending color:", rgb);

    const payload = {
      scale: { x: parseFloat(scaleX), y: parseFloat(scaleY), z: parseFloat(scaleZ) },
      position: { x: parseFloat(posX), y: parseFloat(posY), z: parseFloat(posZ) },
      operations: { 
        subdivide: parseInt(subdivide), 
        unsubdivide: parseInt(unsubdivide),
        autoNormalize: !!autoNormalize,
        proceduralAnim: proceduralAnim
      },
      exportFormats: ['glb', 'obj', 'fbx'],
      material: { 
        color: rgb,
        metallic: parseFloat(metallic),
        roughness: parseFloat(roughness),
        transmission: parseFloat(transmission)
      }
    };

    try {
      const response = await fetch(`/api/process/${fileId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsProcessed(true);
        // Force the model-viewer to refresh its src by incrementing the cache buster
        setCacheBuster(prev => prev + 1);
      } else {
        setError(data.error || 'Failed to process the model. Please check the parameter constraints.');
      }
    } catch {
      setError('A network error occurred while processing the model.');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = (format) => {
    // Navigate browser to download endpoint with format query param
    window.location.href = `/api/download/${fileId}?format=${format}`;
  };

  return (
    <div className="editor-container">
      <div className="editor-top-bar">
        <button type="button" className="back-to-upload-btn" onClick={() => navigate('/')}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Upload
        </button>
        <span className="editor-file-badge">Asset ID: <code>{fileId}</code></span>
      </div>

      <div className="editor-layout">
        {/* LEFT PANEL - Controls */}
        <section className="controls-panel">
          {/* Transformations Section */}
          <div className="control-section">
            <h3>Transformations</h3>
            
            <div className="property-row">
              <span className="property-label">Normalize</span>
              <div className="property-inputs-grid" style={{ alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--text-h)', fontSize: '14px' }}>
                  <input 
                    type="checkbox" 
                    checked={autoNormalize} 
                    onChange={(e) => setAutoNormalize(e.target.checked)} 
                    disabled={processing}
                    style={{ accentColor: 'var(--accent)', width: '16px', height: '16px' }}
                  />
                  Auto-Center & Fit to 1x1x1
                </label>
              </div>
            </div>

            <div className="property-row">
              <span className="property-label">Scale</span>
              <div className="property-inputs-grid">
                <div className="compact-input-box">
                  <span className="input-prefix">X</span>
                  <input 
                    type="number" 
                    value={scaleX} 
                    onChange={(e) => setScaleX(e.target.value)} 
                    step="0.1" 
                    min="0.01" 
                    disabled={processing}
                  />
                </div>
                <div className="compact-input-box">
                  <span className="input-prefix">Y</span>
                  <input 
                    type="number" 
                    value={scaleY} 
                    onChange={(e) => setScaleY(e.target.value)} 
                    step="0.1" 
                    min="0.01" 
                    disabled={processing}
                  />
                </div>
                <div className="compact-input-box">
                  <span className="input-prefix">Z</span>
                  <input 
                    type="number" 
                    value={scaleZ} 
                    onChange={(e) => setScaleZ(e.target.value)} 
                    step="0.1" 
                    min="0.01" 
                    disabled={processing}
                  />
                </div>
              </div>
            </div>

            <div className="property-row">
              <span className="property-label">Position</span>
              <div className="property-inputs-grid">
                <div className="compact-input-box">
                  <span className="input-prefix">X</span>
                  <input 
                    type="number" 
                    value={posX} 
                    onChange={(e) => setPosX(e.target.value)} 
                    step="0.1" 
                    disabled={processing}
                  />
                </div>
                <div className="compact-input-box">
                  <span className="input-prefix">Y</span>
                  <input 
                    type="number" 
                    value={posY} 
                    onChange={(e) => setPosY(e.target.value)} 
                    step="0.1" 
                    disabled={processing}
                  />
                </div>
                <div className="compact-input-box">
                  <span className="input-prefix">Z</span>
                  <input 
                    type="number" 
                    value={posZ} 
                    onChange={(e) => setPosZ(e.target.value)} 
                    step="0.1" 
                    disabled={processing}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Procedural Animation Section */}
          <div className="control-section">
            <h3>Procedural Animation</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Add basic baked movement to static models.</p>
            <div className="property-row">
              <span className="property-label">Movement</span>
              <select 
                value={proceduralAnim} 
                onChange={(e) => setProceduralAnim(e.target.value)}
                className="select-input"
                disabled={processing}
              >
                <option value="none">None</option>
                <option value="spin">Spin (360° Loop)</option>
                <option value="float">Float (Hover up & down)</option>
                <option value="bounce">Bounce (Jump up & down)</option>
              </select>
            </div>
          </div>

          {/* Mesh Operations Section */}
          <div className="control-section">
            <h3>Mesh Operations</h3>
            
            <div className="property-row">
              <span className="property-label">Subdivide</span>
              <div className="property-inputs-grid">
                <div className="compact-input-box">
                  <span className="input-prefix">Cuts</span>
                  <input 
                    type="number" 
                    value={subdivide} 
                    onChange={(e) => setSubdivide(e.target.value)} 
                    min="0" 
                    max="5" 
                    disabled={processing}
                  />
                </div>
              </div>
            </div>

            <div className="property-row">
              <span className="property-label">Unsubdivide</span>
              <div className="property-inputs-grid">
                <div className="compact-input-box">
                  <span className="input-prefix">Iters</span>
                  <input 
                    type="number" 
                    value={unsubdivide} 
                    onChange={(e) => setUnsubdivide(e.target.value)} 
                    min="0" 
                    max="5" 
                    disabled={processing}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Animations Section */}
          <div className="control-section">
            <h3>Animations</h3>
            {animations.length > 0 ? (
              <>
                <div className="property-row">
                  <span className="property-label">Action</span>
                  <select 
                    value={currentAnimation} 
                    onChange={(e) => setCurrentAnimation(e.target.value)}
                    className="select-input"
                  >
                    {animations.map(anim => (
                      <option key={anim} value={anim}>{anim}</option>
                    ))}
                  </select>
                </div>
                <div className="property-row">
                  <span className="property-label">Playback</span>
                  <button 
                    type="button" 
                    className="action-btn" 
                    style={{ flex: 1, padding: '6px 12px', minHeight: 'auto', backgroundColor: isPlaying ? 'var(--bg-tertiary)' : 'var(--accent)' }}
                    onClick={() => setIsPlaying(!isPlaying)}
                  >
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                  </button>
                </div>
              </>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
                {isProcessed ? 'No animations found in this model.' : 'Process model to view animations.'}
              </p>
            )}
          </div>

          {/* Environment & Lighting Section */}
          <div className="control-section">
            <h3>Environment & Lighting</h3>
            <div className="property-row">
              <span className="property-label">Lighting</span>
              <select 
                value={environment} 
                onChange={(e) => setEnvironment(e.target.value)}
                className="select-input"
              >
                {ENVIRONMENTS.map(env => (
                  <option key={env.label} value={env.value}>{env.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Material Properties Section */}
          <div className="control-section">
            <h3>Material Properties</h3>
            
            <div className="property-row">
              <span className="property-label">Base Color</span>
              <input 
                type="color" 
                value={color} 
                onChange={(e) => setColor(e.target.value)} 
                disabled={processing}
                className="color-picker-input"
              />
            </div>
            
            <div className="property-row">
              <span className="property-label" title="0.0 is non-metal, 1.0 is metal">Metallic</span>
              <input 
                type="range" 
                value={metallic} 
                onChange={(e) => setMetallic(e.target.value)} 
                min="0" max="1" step="0.01"
                disabled={processing}
                className="slider-input"
              />
            </div>

            <div className="property-row">
              <span className="property-label" title="0.0 is smooth/shiny, 1.0 is rough">Roughness</span>
              <input 
                type="range" 
                value={roughness} 
                onChange={(e) => setRoughness(e.target.value)} 
                min="0" max="1" step="0.01"
                disabled={processing}
                className="slider-input"
              />
            </div>

            <div className="property-row">
              <span className="property-label" title="0.0 is opaque, 1.0 is glass-like">Transmission</span>
              <input 
                type="range" 
                value={transmission} 
                onChange={(e) => setTransmission(e.target.value)} 
                min="0" max="1" step="0.01"
                disabled={processing}
                className="slider-input"
              />
            </div>
          </div>

          <div className="actions-section">
            {error && (
              <div className="error-alert editor-error">
                <svg className="error-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="error-message">{error}</span>
              </div>
            )}

            <button 
              type="button" 
              className={`action-btn process-btn ${processing ? 'is-loading' : ''}`}
              onClick={handleProcessModel}
              disabled={processing}
            >
              {processing ? (
                <span className="loader-container">
                  <span className="spinner"></span>
                  Processing Model...
                </span>
              ) : 'Process Model'}
            </button>

            {isProcessed && (
              <div className="download-buttons-group">
                <button 
                  type="button" 
                  className="action-btn download-btn-active"
                  onClick={() => handleDownload('glb')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18" className="btn-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download GLB
                </button>
                <button 
                  type="button" 
                  className="action-btn download-btn-active obj-download-btn"
                  onClick={() => handleDownload('obj')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18" className="btn-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download OBJ
                </button>
                <button 
                  type="button" 
                  className="action-btn download-btn-active fbx-download-btn"
                  onClick={() => handleDownload('fbx')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="18" height="18" className="btn-icon">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download FBX
                </button>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT PANEL - 3D Viewer */}
        <section className="viewer-panel">
          {processing ? (
            <div className="viewer-placeholder-box">
              <div className="viewer-spinner" style={{ marginBottom: '20px' }}></div>
              <h3>Processing model, please wait...</h3>
              <p>This may take a few moments depending on model size and operations.</p>
            </div>
          ) : isProcessed ? (
            <div className="viewer-wrapper" style={{ position: 'relative' }}>
              <model-viewer
                ref={modelRef}
                src={`/api/preview/${fileId}?cb=${cacheBuster}`}
                environment-image={environment}
                animation-name={currentAnimation || undefined}
                autoplay={isPlaying ? true : undefined}
                camera-controls
                auto-rotate
                ar
                shadow-intensity="1"
                loading="eager"
                alt="A 3D model of your processed asset"
                style={{ width: '100%', height: '100%' }}
              ></model-viewer>

              <button 
                type="button"
                className="ar-fab-btn"
                onClick={() => setShowQR(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20" style={{ marginRight: '8px' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                View in AR
              </button>

              {showQR && (
                <div className="qr-modal-overlay" onClick={() => setShowQR(false)}>
                  <div className="qr-modal-content" onClick={e => e.stopPropagation()}>
                    <h3 style={{ marginTop: 0 }}>View in your Space (AR)</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-color)' }}>Scan this QR code with your iPhone or Android camera.</p>
                    <div className="qr-code-wrapper">
                      <QRCodeSVG value={arUrl} size={180} bgColor={"#ffffff"} fgColor={"#000000"} level={"Q"} />
                    </div>
                    <p className="qr-hint">Make sure your phone is connected to the same Wi-Fi network.</p>
                    <button className="qr-close-btn" onClick={() => setShowQR(false)}>Close</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="viewer-placeholder-box">
              <div className="viewer-placeholder-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                </svg>
              </div>
              <h3>3D Preview Canvas</h3>
              <p>Configure model scales, position transformations, and mesh cuts, then click <strong>Process Model</strong> to render your asset in real-time.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default Editor;
