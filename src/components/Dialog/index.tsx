import { createPortal } from 'react-dom';
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
    if (!open) return null;

    return createPortal(
        <div className="cp-dialog-backdrop" onClick={onClose}>
            <div className="cp-dialog" onClick={e => e.stopPropagation()} style={style}>
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
