import { Collapse } from "../Collapse";
import "./JsonViewer.scss";

export type JSONValue =
	| string
	| number
	| boolean
	| null
	| { [key: string]: JSONValue }
	| JSONValue[];


export function JsonViewer({
    data,
    path = '',
    renderValue = (v) => String(v),
    root = data
}: {
    data: JSONValue,
    renderValue?: (v: string | number | boolean | null, path?: string, root?: JSONValue) => React.ReactNode,
    path?: string,
    root?: JSONValue
}) {
    if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean' || data === null) {
        const tokenType = data === null ? 'null' : typeof data;
        return <div className={`token token-${tokenType}`}>{renderValue(data, path || String(data), root)}</div>;
    }

    if (data instanceof Date) {
        return <div className="token token-date">{data.toString()}</div>;
    }

    // if (typeof data.toString === 'function' && data.toString !== Object.prototype.toString) {
    //     return <div className="token token-string">{data.toString()}</div>;
    // }

    if (Array.isArray(data)) {
        return (
            <div className="cp-tree">
                {data.map((item, index) => {
                    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) {
                        const tokenType = item === null ? 'null' : typeof item;
                        return (
                            <div key={index}>
                                <b className="key">{index}:</b>
                                <div className={`token token-${tokenType}`}>{renderValue(item, `${path}[${index}]`, root)}</div>
                            </div>
                        );
                    }
                    return (
                        <Collapse key={index} label={<b className="key">{index}</b>}>
                            <JsonViewer data={item} renderValue={renderValue} path={`${path}[${index}]`} root={root} />
                        </Collapse>
                    );
                })}
            </div>
        );
    }

    if (data && typeof data === 'object') {

        // if (typeof data.toString === 'function' && data.toString !== Object.prototype.toString) {
        //     return <div className="token token-string">{data.toString()}</div>;
        // }

        path = path || String(data.resourceType);
        return (
            <div className="cp-tree">
                {Object.entries(data).map(([key, value], idx) => {
                    const tokenType = value === null ? 'null' : typeof value;
                    if (tokenType == "undefined") {
                        return (
                            <div key={idx}>
                                <b className="key">{key}:</b>
                                <div className="token token-undefined">undefined</div>
                            </div>
                        );
                    }
                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
                        return (
                            <div key={idx}>
                                <b className="key">{key}:</b>
                                <div className={`token token-${tokenType}`}>{renderValue(value, `${path}.${key}`, root)}</div>
                            </div>
                        );
                    }
                    if (value instanceof Date) {
                        return (
                            <div key={idx}>
                                <b className="key">{key}:</b>
                                <div className={`token token-date`}>{value.toLocaleString()}</div>
                            </div>
                        );
                    }
                    return (
                        <Collapse label={<><b className="key">{key}</b> <span style={{ color: '#8888' }}>{String(value.constructor.name)}</span></>} key={idx}>
                            <JsonViewer data={value} renderValue={renderValue} path={`${path}.${key}`} root={root} />
                        </Collapse>
                    )
                })}
            </div>
        );
    }

    return <div className="cp-ps-3 token token-undefined">undefined</div>;
}
