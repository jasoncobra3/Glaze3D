import { useParams } from 'react-router-dom';

function ARViewer() {
  const { fileId } = useParams();

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 60px)', background: 'var(--bg-primary)' }}>
      <model-viewer
        src={`/api/preview/${fileId}?cb=${Date.now()}`}
        camera-controls
        auto-rotate
        ar
        ar-modes="webxr scene-viewer quick-look"
        shadow-intensity="1"
        style={{ width: '100%', height: '100%' }}
        alt="AR 3D Model"
      >
        <div slot="poster" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-color)', fontFamily: 'sans-serif' }}>
          Loading AR Model...
        </div>
      </model-viewer>
    </div>
  );
}

export default ARViewer;
