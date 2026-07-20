import { createPortal } from 'react-dom';
import { useRef } from 'react';
import './Dialog.scss';
import { XIcon } from 'lucide-react';

export function Dialog({
    open,
    onClose,
    title,
    children,
    style,

}: {
    open: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    style?: React.CSSProperties;
}) {
    const mouseDownOnBackdrop = useRef(false);

    if (!open) return null;

    return createPortal(
        <div
            className="cp-dialog-backdrop"
            onMouseDown={e => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
            onClick={() => { if (mouseDownOnBackdrop.current) onClose(); }}
        >
            <div className="cp-dialog" style={style}>
                <div className="cp-dialog-header">
                    <span className="cp-dialog-title">{title}</span>
                    <button className="cp-dialog-close" onClick={onClose}>
                        <XIcon size={"1.25em"} className="cp-dialog-close-icon" />
                    </button>
                </div>
                <div className="cp-dialog-body">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
