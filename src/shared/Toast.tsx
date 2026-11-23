import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function Toast({
  message,
  actionLabel = 'Отменить',
  onAction,
  onClose,
  duration = 4500,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  duration?: number;
}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => closeRef.current(), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  return createPortal(
    <div className="toast" role="status">
      <span className="toast-text">{message}</span>
      {onAction ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            onAction();
            closeRef.current();
          }}
        >
          {actionLabel}
        </button>
      ) : null}
      <button type="button" className="toast-close" aria-label="Закрыть" onClick={() => closeRef.current()}>
        ×
      </button>
    </div>,
    document.body,
  );
}
