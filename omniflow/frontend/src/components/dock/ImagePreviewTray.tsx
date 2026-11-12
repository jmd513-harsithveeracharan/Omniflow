import React from 'react';
import { X } from 'lucide-react';

interface ImagePreviewTrayProps {
  images: string[];
  onRemoveImage: (index: number) => void;
}

export const ImagePreviewTray: React.FC<ImagePreviewTrayProps> = ({ images, onRemoveImage }) => {
  if (images.length === 0) return null;

  return (
    <div className="dock-image-preview-tray">
      {images.map((imgUrl, idx) => (
        <div key={idx} className="dock-image-thumb-box">
          <img src={imgUrl} alt={`Upload ${idx + 1}`} className="dock-image-thumb-img" />
          <button
            type="button"
            className="dock-image-thumb-remove"
            title="Remove image"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveImage(idx);
            }}
          >
            <X size={10} />
          </button>
        </div>
      ))}
      <span className="dock-image-tray-hint">
        {images.length} image{images.length > 1 ? 's' : ''} attached
      </span>
    </div>
  );
};
