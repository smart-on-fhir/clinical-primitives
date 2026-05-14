import { DatabaseIcon }       from "lucide-react";
import { Dialog }             from ".";
import FhirResourceJsonViewer from "../../components/JsonViewer/FhirJsonViewer";
import { useClinicalData }    from "../../library";
import { Tab, TabBar, TabContents, Tabs, TabsBody } from "../Tabs";
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight }   from 'react-syntax-highlighter/dist/esm/styles/prism';


interface TabDefinition {
    label: React.ReactNode;
    content: React.ReactNode;
}

export function SourceDialog({
    open,
    onClose,
    resource,
    prependTabs = [],
    appendTabs = [],
    style = {},
    icon = <DatabaseIcon size={'1.1em'} strokeWidth={1} style={{ display: 'block' }} />,
    title = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
            { icon && <div>{icon}</div> }
            <div>FHIR Resource</div>
        </div>),
}: {
    open: boolean;
    title?: React.ReactNode;
    icon?: React.ReactNode;
    onClose: () => void;
    resource: object;
    prependTabs?: TabDefinition[];
    appendTabs?: TabDefinition[];
    minWidth?: string | number;
    maxWidth?: string | number;
    height?: string | number;
    style?: React.CSSProperties;
}) {
    const { resources } = useClinicalData();
    
    return (
        <Dialog open={open} onClose={onClose} title={title} style={{ minWidth: 300, maxWidth: '90vw', width: 600, ...style }}>
            <Tabs style={{ display: 'flex', flexDirection: 'column', height: '100%', flex: '1 1 auto' }}>
                <TabBar className="cp-fill-win-1">
                    {prependTabs.map((tab, idx) => (
                        <Tab key={`prepend-${idx}`}>{tab.label}</Tab>
                    ))}
                    <Tab>Tree</Tab>
                    <Tab>JSON</Tab>
                    {appendTabs.map((tab, idx) => (
                        <Tab key={`append-${idx}`}>{tab.label}</Tab>
                    ))}
                </TabBar>
                <TabsBody style={{ overflow: 'auto', flex: '1 1 auto', padding: '1rem' }}>
                    {prependTabs.map((tab, idx) => (
                        <TabContents key={`prepend-content-${idx}`}>
                            {tab.content}
                        </TabContents>
                    ))}
                    <TabContents>
                        <div className="cp-text-sm" style={{ margin: 0, padding: 0 }}>
                            <FhirResourceJsonViewer resource={resource as any} allResources={resources} />
                        </div>
                    </TabContents>
                    <TabContents>
                        <SyntaxHighlighter style={oneLight} language="json" className="cp-text-sm" customStyle={{ margin: '-1rem', padding: '1rem', background: 'none', lineHeight: '1.2em' }}>
                            {JSON.stringify(resource, null, 2)}
                        </SyntaxHighlighter>
                        {/* <pre className="cp-text-xs" style={{ margin: 0, padding: 0, whiteSpace: 'pre-wrap' }}>
                            {JSON.stringify(resource, null, 2)}
                        </pre> */}
                    </TabContents>
                    {appendTabs.map((tab, idx) => (
                        <TabContents key={`append-content-${idx}`}>
                            {tab.content}
                        </TabContents>
                    ))}
                </TabsBody>
            </Tabs>
        </Dialog>
    );
}