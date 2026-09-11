import { DataGrid }                                    from "./DataGrid"
import { DataGridColumn, DataGridProps }               from "./types"
import { FhirResource }                                from "fhir/r4"
import { getPath, highlightText }                      from "../../utils"
import { FhirResourceJsonViewer }                      from "../JsonViewer/FhirJsonViewer";
import { ReactNode, useCallback, useEffect, useState } from "react";
import "./DataGrid.scss"


type AnyObj = { [k: string]: any };

function inferColumns(items: AnyObj[], maxCols = 12, search = ""): DataGridColumn[] {
    const cols: DataGridColumn[] = [];
    for (const it of items) {
        if (!it || typeof it !== 'object') continue;
        for (const k of Object.keys(it)) {
            if (k === "resourceType") continue;
            if (!cols.some(c => c.propName === k)) {
                cols.push({
                    propName : k,
                    label    : k,
                    sortProp : k,
                    renderCell(row, all) {
                        return renderDataGridCell(row[k], row, this, search);
                    }
                });
            }
            if (cols.length >= maxCols) break;
        }
        if (cols.length >= maxCols) break;
    }

    // Columns whose values are objects (CodeableConcept, Reference, arrays,
    // ...) can't be meaningfully compared, so they shouldn't be sortable.
    for (const col of cols) {
        const hasObjectValue = items.some(it => {
            const value = it?.[col.propName!]
            return value !== null && typeof value === "object"
        })
        if (hasObjectValue) delete col.sortProp
    }

    return cols;
}

function renderDataGridCell(value: any, row: any, col: DataGridColumn, search = "") {

    // empty cell if undefined
    if (value === undefined)
        return null

    // grey null if null
    if (value === null)
        return <code className="cp-text-win-7">null</code>

    if (typeof value === "object") {
        if (Array.isArray(value)) {
            return (
                <>{value.map((v, i) => <div className="cp-data-grid-array-item" key={i}>{renderDataGridCell(v, row, col, search)}</div>)}</>
            )
        }

        if (Object.keys(value).length === 1) {
            const key = Object.keys(value)[0];
            return renderDataGridCell(value[key], row, col, search);
        }

        if (value.system && value.code) {
            return <div className="cp-text-txt-4" title={value.system + "|" + value.code}>{highlightText(value.code, search)}</div>
        }

        if (Array.isArray(value.coding) && value.coding.length > 0) {
            if (value.text) {
                return <span className="cp-text-txt-4" title={value.coding[0].system + "|" + value.coding[0].code}>{highlightText(value.text, search)}</span>
            }
            return <span className="cp-text-txt-4" title={value.coding[0].system + "|" + value.coding[0].code}>{highlightText(value.coding[0].code, search)}</span>
        }

        if (value.reference) {
            return <a href={value.reference}>{highlightText(value.reference, search)}</a>
        }

        return <FhirResourceJsonViewer resource={value as any} allResources={{}} />
    }

    // default rendering for other types
    return <span className="cp-text-txt-4">{ highlightText(value + "", search) }</span>
}


export default function FhirDataGrid({
    resources,
    columns,
    limit = 10,
    title
} : {
    resources: FhirResource[],
    columns?: DataGridProps["columns"],
    limit?: number
    title?: ReactNode
}) {
    const [sortColumn , setSortColumn] = useState("")
    const [sortDir    , setSortDir   ] = useState<"asc"|"desc">("asc")
    const [search     , setSearch    ] = useState("")
    const [_offset    , setOffset    ] = useState(0)
    const [_limit     , setLimit     ] = useState(limit)
    const [data       , setData      ] = useState<any[]>(resources || [])
    const [matchCount , setMatchCount] = useState(resources?.length || 0)


    const fetch = useCallback(({
        limit      = _limit,
        offset     = _offset,
        sortColumn: _sortColumn = sortColumn,
        sortDir   : _sortDir    = sortDir,
        search    : _search     = search,
    }: {
        offset    ?: number
        limit     ?: number
        sortColumn?: string
        sortDir   ?: "asc"|"desc"
        search    ?: string
    } = {}) => {

        console.log("fetching with options", { limit, offset, sortColumn: _sortColumn, sortDir: _sortDir, search: _search })

        let _rows = [...(resources || [])];

        // search ------------------------------------------------------------
        if (_search) {
            const term = _search.toLowerCase()
            _rows = _rows.filter(row => JSON.stringify(row).toLowerCase().includes(term))
        }
        setSearch(_search)
        setMatchCount(_rows.length)

        // sort ------------------------------------------------------------
        if (_sortColumn) {
            _rows.sort((a: any, b: any) => {
                const _a = getPath(a, _sortColumn)
                const _b = getPath(b, _sortColumn)
                const _d = _sortDir === "asc" ? 1 : -1
                if (typeof _a === "number" && typeof _b === "number") {
                    return (_a - _b) * _d
                }
                return String(_a ?? "").localeCompare(String(_b ?? "")) * _d
            })
            setSortColumn(_sortColumn)
            setSortDir(_sortDir)
        }

        // offset --------------------------------------------------------------
        if (offset || offset === 0) {
            _rows = _rows.slice(offset)
            setOffset(offset)
        }

        // limit ---------------------------------------------------------------
        if (limit) {
            _rows = _rows.slice(0, limit)
            setLimit(limit)
        }

        setData(_rows)
    }, [resources, columns, _limit, _offset, sortColumn, sortDir, search])

    useEffect(fetch, [])

    return <DataGrid
        title={ title }
        columns={ inferColumns(resources, 12, search) }
        // className={ className }
        count={ matchCount }
        offset={ _offset }
        limit={ _limit }
        rows={ data }
        sortColumn={ sortColumn }
        sortDir={ sortDir }
        search={ search }
        // selection={ selection }
        // onSelectionChange={ onSelectionChange }
        // identity={ identity }
        // filters={ where }
        onPaginationChange={ offset => fetch({ offset }) }
        onSortChange={ (sortColumn, sortDir) => fetch({ sortColumn, sortDir, offset: 0 }) }
        onSearchChange={ search => fetch({ search, offset: 0 }) }
        // @ts-ignore
        // onFilterChange={ where => fetch({ where }) }
        // error={ error }
    />
}