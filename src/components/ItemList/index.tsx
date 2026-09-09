import { ReactNode }              from "react"
import { PlusCircle, Trash2Icon } from "lucide-react"
import "./ItemList.scss"


type Item = string | [string] | [string, string] | { name: string, value: string } | any;

function ParamListRow({
    datalistId,
    item,
    onChange
}: {
    item: Item,
    datalistId?: string,
    onChange: (changed: typeof item) => void
}) {

    // string
    if (typeof item === 'string') {
        return (
            <div className="cp-param-list-col">
                <input type="text" list={datalistId} value={item} onChange={e => onChange(e.target.value)} />
            </div>
        )
    }

    // [string]
    if (Array.isArray(item) && item.length === 1 && typeof item[0] === 'string') {
        return (
            <div className="cp-param-list-col">
                <input type="text" list={datalistId} value={item[0]} onChange={e => onChange([e.target.value])} />
            </div>
        )
    }

    // [string, string]
    if (Array.isArray(item) && item.length === 2 && typeof item[0] === 'string' && typeof item[1] === 'string') {
        return [
            <div className="cp-param-list-col" key='name-column'>
                <input type="text" list={datalistId} value={item[0]} onChange={e => onChange([e.target.value, item[1]])} />
            </div>,
            <div className="cp-param-list-col" key='value-column'>
                <input type="text" value={item[1]} onChange={e => onChange([item[0], e.target.value])} />
            </div>
        ];
    }

    // { name: string, value: string }
    if (item && typeof item === 'object' && Object.keys(item).length === 2 && item.hasOwnProperty('name') && item.hasOwnProperty('value')) {
        const { name, value } = item;
        return [
            <div className="cp-param-list-col" key='name-column'>
                <input type="text" list={datalistId} value={name + ''} onChange={e => onChange({ name: e.target.value, value })} />
            </div>,
            <div className="cp-param-list-col" key='value-column'>
                <input type="text" value={value + ''} onChange={e => onChange({ name, value: e.target.value })} />
            </div>
        ];
    }

    // any as string
    return (
        <div className="cp-param-list-col">
            <input type="text" list={datalistId} value={String(item)} onChange={e => onChange(e.target.value)} />
        </div>
    )
}

export function ItemList({
    params,
    onChange,
    datalistId,
    label = "Entry",
    getNewItem,
    renderItem,
    emptyMsg = `No entires`
}: {
    /**
     * Current list
     * @type string | [string] | [string, string] | { name: string, value: string } | any
     */
    params: Item[]

    /**
     * To be called with the new params list when it changes
     */
    onChange: (p: typeof params) => void

    /**
     * Optional ID of datalist element to be linked to the name input
     */
    datalistId?: string

    label?: string

    getNewItem?: () => Item

    renderItem?: (item: Item, index: number) => ReactNode

    emptyMsg?: ReactNode
}) {
    const rows: ReactNode[] = []
    const size = params.length

    params.forEach((item, i) => {
        rows.push(
            <div className="cp-param-list-row" key={i}>
                { renderItem ?
                    renderItem(item, i) :
                    <ParamListRow datalistId={datalistId} item={item} onChange={x => {
                        params[i] = x
                        onChange(params)
                    }} />
                }
                { getNewItem && <div className="cp-param-list-col col-0">
                    <button
                        type="button"
                        className="btn btn-virtual px-05"
                        data-tooltip={"Remove " + label}
                        onClick={() => { params.splice(i, 1); onChange(params); }}>
                        <Trash2Icon size={16} />
                    </button>
                </div> }
            </div>
        )
    })

    return (
        <div className="cp-param-list">
            { size ? rows : <div className="cp-param-list-message">{ emptyMsg }</div> }
            { getNewItem && <div className="cp-param-list-footer">
                <button type="button" onClick={() => {
                    onChange([ ...params, getNewItem()])
                }}><PlusCircle size={16} /> Add {label}</button>
            </div> }
        </div>
    )
}