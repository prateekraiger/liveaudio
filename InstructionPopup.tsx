import { useState, useEffect } from "react";

interface InstructionPopupProps {
  onClose: () => void;
}

const InstructionPopup: React.FC<InstructionPopupProps> = ({ onClose }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-hide after 10 seconds
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setVisible(false);
    onClose();
  };

  const styles = `
    .popup-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      animation: fadeIn 0.3s ease-in-out;
    }

    .popup-content {
      background-color: #1a1a1a;
      border-radius: 12px;
      padding: 24px;
      max-width: 500px;
      width: 90%;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
      color: white;
      font-family: sans-serif;
      animation: slideIn 0.3s ease-in-out;
    }

    .popup-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .popup-title {
      font-size: 24px;
      font-weight: bold;
      margin: 0;
    }

    .popup-close {
      background: none;
      border: none;
      color: #aaa;
      font-size: 24px;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }

    .popup-close:hover {
      color: white;
    }

    .popup-body {
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .popup-instruction {
      margin-bottom: 12px;
    }

    .popup-button {
      background-color: #4a90e2;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .popup-button:hover {
      background-color: #357ae8;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideIn {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;

  if (!visible) return null;

  return (
    <>
      <style>{styles}</style>
      <div className="popup-overlay">
        <div className="popup-content">
          <div className="popup-header">
            <h2 className="popup-title">How to Use This App</h2>
            <button className="popup-close" onClick={handleClose}>
              &times;
            </button>
          </div>
          <div className="popup-body">
            <p className="popup-instruction">
              <strong>1.</strong> Click the red button to start recording your
              voice.
            </p>
            <p className="popup-instruction">
              <strong>2.</strong> Ask any question directly - the AI will
              respond immediately.
            </p>
            <p className="popup-instruction">
              <strong>3.</strong> Click the black square button to stop
              recording when you're done.
            </p>
            <p className="popup-instruction">
              <strong>4.</strong> Use the reset button (circular arrow) to start
              a new conversation.
            </p>
          </div>
          <button className="popup-button" onClick={handleClose}>
            Got it!
          </button>
        </div>
      </div>
    </>
  );
};

export default InstructionPopup;
