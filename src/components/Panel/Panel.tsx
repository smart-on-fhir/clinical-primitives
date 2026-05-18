import { makeWrapperComponent } from "../../utils";
import "./Panel.scss";

export const Panel        = makeWrapperComponent('cp-panel');
export const PanelBody    = makeWrapperComponent('cp-panel-body');
export const PanelToolbar = makeWrapperComponent('cp-panel-toolbar');
export const PanelFooter  = makeWrapperComponent('cp-panel-footer');


export function PanelHeader({
    title,
    icon,
    rightContent
}: {
    title: React.ReactNode;
    icon?: React.ReactNode;
    rightContent?: React.ReactNode;
}) {
    return (
        <div className="cp-panel-header">
            {icon && <div className="cp-panel-icon">{icon}</div>}
            <div className="cp-panel-title">{title}</div>
            <div className="cp-panel-header-spacer"/>
            {rightContent && <div className="cp-panel-header-right">{rightContent}</div>}
        </div>
    );
}
