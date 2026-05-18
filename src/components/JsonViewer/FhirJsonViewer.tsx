import type { DocumentReference, Resource }  from "fhir/r4";
import { Collapse }                          from "../Collapse";
import { JsonViewer, type JSONValue }        from ".";
import AttachmentPreview                     from "./Attachment";
import { ResourcesByType }                   from "../../fhir/types";
import { SquareArrowUpRight, TriangleAlert } from "lucide-react";


export function Decorator({ children, type }: { children: React.ReactNode; type?: 'number' | 'boolean' | 'string' }) {
    
    if (typeof children === 'string') {
        
        // URL values
        if (children.match(/^https?:\/\/.+/)) {
            return (
                <a href={children} target="_blank" rel="noopener noreferrer" className="cp-text-blue">
                    {children}
                    <SquareArrowUpRight size={"1.2em"} style={{ verticalAlign: 'text-bottom', marginLeft: '0.25em' }} />
                </a>
            );
        }

        // Date values
        if (children.match(/^\d{4}-\d{2}-\d{2}/)) {
            return <span  className="cp-text-amber">{children}</span>;
        }
    }

    return children;
}


export function createValueRenderer(allResources: ResourcesByType) {
    return function renderValue(value: string | number | boolean | null, path?: string, root?: JSONValue): React.ReactNode {
        
        // Root nodes
        if (!path) {
            return String(value);
        }

        // Numbers
        if (typeof value === "number") {
            return value;
        }

        // Booleans
        if (typeof value === "boolean") {
            return String(value);    
        }

        // null or undefined
        if (value === null || value === undefined) {
            return value;
        }

        // URL values
        if (value.match(/^https?:\/\/.+/)) {
            return (
                <a href={value} target="_blank" rel="noopener noreferrer" className="cp-text-blue">
                    {value}
                    <SquareArrowUpRight size={"1.2em"} style={{ verticalAlign: 'text-bottom', marginLeft: '0.25em' }} />
                </a>
            );
        }

        // Date values
        if (value.match(/^\d{4}-\d{2}-\d{2}/)) {
            return <span  className="cp-text-amber">{value}</span>;
        }

        // Attachment data in DocumentReference
        const match = path.match(/^DocumentReference\.content\[(\d+)\]\.attachment\.data$/);
        if (match) {
            console.log('Found attachment data:', path, value, match);
            if (root && typeof root === 'object' && (root as any).resourceType === 'DocumentReference') {
                const attachment = (root as unknown as DocumentReference).content?.[+match[1]]?.attachment;
                if (attachment) {
                    console.log('Attachment details:', attachment);
                    return (
                        <Collapse label={<span className="cp-text-blue">{attachment.title || 'Attachment'}</span>}>
                            <AttachmentPreview attachment={attachment} />
                        </Collapse>
                    );
                }
            }
            return <span className="cp-text-purple">{value}</span>;
        }

        // Reference values
        if (path.endsWith('.reference') || path.endsWith('.url')) {
            const [resourceType, id] = value.split('/');
            if (resourceType && id) {
                const resource = allResources[resourceType]?.find(r => r.id === id);
                if (resource) {
                    return (
                        <Collapse label={<span className="cp-text-blue">{value}</span>}>
                            <JsonViewer data={resource as any} renderValue={renderValue} />
                        </Collapse>
                    );
                } else {
                    return (
                        <span className='cp-text-red' title="Not found in patient's resources">
                            {value}
                            {/* <i className="bi bi-exclamation-triangle-fill ms-1" /> */}
                            <TriangleAlert size={"1.2em"} style={{ verticalAlign: 'text-bottom', marginLeft: '0.25em' }} />
                        </span>
                    );
                }
            }
        }

        // Multi-line strings
        if (typeof value === 'string' && value.includes('\n')) {
            return (
                <Collapse label={<span className="cp-text-blue">Multi-line string ({value.split('\n').length} lines)</span>}>
                    <pre className="cp-text-txt-5" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, fontSize: '90%' }}>{value}</pre>
                </Collapse>
            );
        }

        // Normal strings
        return String(value);
    };
}

export function FhirResourceJsonViewer({
    resource,
    allResources
}: {
    resource    : Resource,
    allResources: ResourcesByType
}) {
    const renderValue = createValueRenderer(allResources);
    return <JsonViewer data={resource as any} renderValue={renderValue} />;
}