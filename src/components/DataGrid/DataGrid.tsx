import { useLayoutEffect, useRef, useState } from "react"
import { Loader }                            from "../Loader"
import { Alert }                             from "../Alert"
import { CheckBox }                          from "../CheckBox"
import { Pagination }                        from "../Pagination"
import { classList, getPath, highlightText } from "../../utils"
import { formatFhirDateTime }                from "../Date/utils"
import { DataGridColumn, DataGridProps }     from "./types"
import { Column }                            from "../Column"
import { Row }                               from "../Row"
import { Menu, MenuItemGroupHeader }         from "../Menu"
import { MenuButton }                        from "../MenuButton"
import {
    ArrowRightCircle, ChevronDown, ChevronsUpDown, ChevronUp, CogIcon, LinkIcon
} from "lucide-react"
import "./DataGrid.scss"



export function DataGrid(props: DataGridProps) {
    
    const {
        onSortChange,
        onNavigate,
        selection,
        offset     = 0,
        limit      = 15,
        rows       = [],
        sortColumn = "",
        sortDir    = "desc",
        count      = rows.length,
        identity,
        loading,
        error,
        title = ""
    } = props

    // Controlled if the caller passes `search` (same convention as sorting
    // and pagination), otherwise managed internally so the box is still
    // usable (highlighting included) without any wiring.
    const [internalSearch, setInternalSearch] = useState(props.search ?? "")
    const search = props.search ?? internalSearch
    function handleSearchChange(value: string) {
        setInternalSearch(value)
        props.onSearchChange?.(value)
    }

    const initialColumnVisibility: Record<string, boolean> = {}
    props.columns.forEach(col => initialColumnVisibility[col.propName!] = col.visible !== false)
    
    const [columnVisibility, setColumnVisibility] = useState(initialColumnVisibility)

    const initialColumnWidths: Record<string, number> = {}
    props.columns.forEach(col => { if (col.width) initialColumnWidths[col.propName!] = col.width })

    const [columnWidths, setColumnWidths] = useState(initialColumnWidths)

    const [widthsLocked, setWidthsLocked] = useState(false)

    // Columns with no pinned pixel width of their own: always the last
    // visible one (so there's no gap after it), plus any column the user
    // has double-clicked back to "auto" - which stays auto until the next
    // manual drag pins it again. Their width is derived below (see
    // autoWidths) as an equal share of whatever space is left over, so they
    // fill the remaining space and grow the table past the container instead
    // of the browser distributing that space across every column when we ask
    // the table for min-width 100% (both of which happened when we left this
    // to `table-layout: fixed` to figure out on its own).
    const [autoColumnNames, setAutoColumnNames] = useState<Set<string>>(new Set())

    // Tracked continuously (via ResizeObserver below) so auto columns can
    // keep filling the available space as the wrapper itself resizes.
    const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined)

    const thRefs = useRef<Record<string, HTMLTableCellElement | null>>({})
    const wrapperRef = useRef<HTMLDivElement | null>(null)

    const resizingRef = useRef<{ propName: string, startX: number, startWidth: number } | null>(null)

    const visibleColumns = props.columns.filter(col => columnVisibility[col.propName!])
    const lastCol = visibleColumns[visibleColumns.length - 1]
    const isAutoCol = (col: DataGridColumn) => col === lastCol || autoColumnNames.has(col.propName!)
    const fixedColumns = visibleColumns.filter(col => !isAutoCol(col))
    const autoColumns = visibleColumns.filter(isAutoCol)

    useLayoutEffect(() => {
        if (!wrapperRef.current) return
        const observer = new ResizeObserver(entries => {
            setContainerWidth(entries[0].contentRect.width)
        })
        observer.observe(wrapperRef.current)
        return () => observer.disconnect()
    }, [])

    // Column widths are only reliable once every non-auto column has an
    // explicit pixel width. So we let the browser size the header naturally
    // on first paint (table-layout: auto), measure it, and only then lock in
    // `table-layout: fixed` with those widths.
    useLayoutEffect(() => {
        const toMeasure = [
            ...(onNavigate ? ["__nav__"] : []),
            ...fixedColumns.map(col => col.propName!)
        ]
        const missing = toMeasure.filter(propName => columnWidths[propName] === undefined)
        if (!missing.length) {
            if (!widthsLocked) setWidthsLocked(true)
            return
        }
        const updates: Record<string, number> = {}
        missing.forEach(propName => {
            const th = thRefs.current[propName]
            if (th) updates[propName] = Math.ceil(th.getBoundingClientRect().width)
        })
        if (Object.keys(updates).length) {
            setColumnWidths(widths => ({ ...widths, ...updates }))
        }
    }, [props.columns, columnVisibility, columnWidths, widthsLocked, onNavigate, autoColumnNames])

    const navWidth = onNavigate ? columnWidths["__nav__"] : 0
    const sumFixed = fixedColumns.reduce((sum, col) => sum + (columnWidths[col.propName!] ?? 0), 0)

    const autoWidths: Record<string, number> = {}
    if (widthsLocked && containerWidth !== undefined && autoColumns.length) {
        const available = containerWidth - sumFixed - (navWidth ?? 0)
        const share = available / autoColumns.length
        autoColumns.forEach(col => {
            autoWidths[col.propName!] = Math.max(col.minWidth ?? 60, share)
        })
    }
    const sumAuto = autoColumns.reduce((sum, col) => sum + (autoWidths[col.propName!] ?? 0), 0)
    const tableWidth = Object.keys(autoWidths).length
        ? sumFixed + (navWidth ?? 0) + sumAuto
        : undefined

    function startResize(e: React.MouseEvent, propName: string, minWidth: number) {
        e.preventDefault()
        const th = (e.currentTarget as HTMLElement).closest("th")
        const startWidth = columnWidths[propName] ?? th?.getBoundingClientRect().width ?? minWidth
        resizingRef.current = { propName, startX: e.clientX, startWidth }

        // A manual drag pins the column back to a fixed width, whether it
        // was already pinned or currently auto (e.g. reset via double-click).
        // Both updates must land in the same batch: dropping it from the auto
        // set without also giving it a columnWidths entry right away would
        // leave it briefly neither auto nor pinned, collapsing it to 0 width
        // until the first mousemove.
        setAutoColumnNames(names => {
            if (!names.has(propName)) return names
            const next = new Set(names)
            next.delete(propName)
            return next
        })
        setColumnWidths(widths => ({ ...widths, [propName]: startWidth }))

        function onMouseMove(e: MouseEvent) {
            const resizing = resizingRef.current
            if (!resizing) return
            const width = Math.max(minWidth, resizing.startWidth + (e.clientX - resizing.startX))
            setColumnWidths(widths => ({ ...widths, [resizing.propName]: width }))
        }

        function onMouseUp() {
            resizingRef.current = null
            window.removeEventListener("mousemove", onMouseMove)
            window.removeEventListener("mouseup", onMouseUp)
        }

        window.addEventListener("mousemove", onMouseMove)
        window.addEventListener("mouseup", onMouseUp)
    }

    // Drops the column's pinned width and marks it auto, so it keeps filling
    // whatever space is left over (like the last column always does) until
    // the next manual drag pins it again.
    function resetColumnWidth(propName: string) {
        setColumnWidths(({ [propName]: _, ...rest }) => rest)
        setAutoColumnNames(names => new Set(names).add(propName))
    }

    const totalPages = Math.ceil(count / limit)

    const shouldHavePagination = totalPages > 1 && props.onPaginationChange

    function renderColumnGroup() {
        return (
            <colgroup>
                { onNavigate && <col style={{ width: navWidth ? `${navWidth}px` : "1em" }} /> }
                { visibleColumns.map((col, i) => {
                    const width = isAutoCol(col) ? autoWidths[col.propName!] : columnWidths[col.propName!]
                    return <col key={i} style={{ width: width !== undefined ? `${width}px` : undefined }} />
                })}
            </colgroup>
        )
    }

    function renderDataGridHeader() {
        return (
            <thead>
                <tr className="bg-soft">
                { onNavigate && <th style={{ width: "1em", textAlign: "center" }} ref={ el => { thRefs.current["__nav__"] = el } }>
                    <LinkIcon className="sort-icon" size="1em" />
                </th> }
                { visibleColumns.map((col, i) => (
                    <th {...col.thProps} key={i} ref={ el => { thRefs.current[col.propName!] = el } } className={ classList({
                        [col.thProps?.className ?? ""]: true,
                        "sorted" : !!(col.sortProp && col.sortProp === sortColumn && rows.length > 0)
                    })}>
                        <div style={{ cursor: col.sortProp && onSortChange ? "pointer" : "default" }} onClick={ () => {
                            if (col.sortProp && onSortChange) {
                                onSortChange(col.sortProp, sortDir === "asc" ? "desc" : "asc")
                            }
                        }} className="header-line">
                            { col.sortProp && ( col.sortProp === sortColumn ?
                                rows.length > 0 ?
                                    sortDir === "desc" ?
                                        <ChevronDown size={14} style={{ marginRight: "0.2em" }} /> :
                                        <ChevronUp size={14} style={{ marginRight: "0.2em" }} /> :
                                    <ChevronsUpDown size={14} style={{ marginRight: "0.2em", opacity: 0.3 }} /> :
                                    <ChevronsUpDown size={14} style={{ marginRight: "0.2em", opacity: 0.3 }} />
                            ) }
                            <div className="header-label">
                                { col.renderHeader ? col.renderHeader() : col.label ?? (col.propName ?? "") }
                            </div>

                        </div>
                        { col !== lastCol && <div
                            className="column-resize-handle"
                            onMouseDown={ e => startResize(e, col.propName!, col.minWidth ?? 60) }
                            onDoubleClick={ () => resetColumnWidth(col.propName!) }
                        /> }
                    </th>
                ))}
                </tr>
            </thead>
        )
    }

    function renderDataGridBody() {
        return (
            <tbody className="table-group-divider">
                { rows.map((row, rowIndex) => {
                    const selected = !!selection?.includes(row[identity!])
                    return (
                        <tr key={ rowIndex }>
                            { onNavigate && <td
                                className={ classList({ selected, "navigate-icon-cell": true }) }
                                onClick={ () => onNavigate(row, rowIndex) }>
                                <ArrowRightCircle className="navigate-icon" size="1em" />
                            </td> }
                            { visibleColumns.map((col, colIndex) => (
                                <td { ...col.tdProps } key={colIndex} className={ classList({
                                    [col.tdProps?.className ?? ""]: true,
                                    clamp: true,
                                    selected
                                }) }><div className="clamp" tabIndex={0}>{ renderDataGridCell(row, col) }</div></td>
                            ))}
                        </tr>
                    )
                }) }
            </tbody>
        )
    }

    function renderDataGridCell(row: any, col: DataGridColumn) {
        if (col.renderCell) {
            return col.renderCell(row, rows)
        }

        const value = getPath(row, col.propName)

        if (value === undefined)
            return <code className="cp-text-win-7">undefined</code>
        if (value === null)
            return <code className="cp-text-win-7">null</code>

        switch (col.dataType) {
            case "boolean":
                return !!value ? "true" : "false";
            case "json":
                return highlightText(JSON.stringify(value), search)
            case "number":
                return <div className="cell--number"><code>{ highlightText(Number(value).toLocaleString(), search) }</code></div>
            case "date":
                return <time className="cell--date" dateTime={value}>{ highlightText(formatFhirDateTime(value), search) }</time>
            case "id":
                return <code className="cell--id">{ highlightText(value + "", search) }</code>
        }

        if (typeof value === "object") {
            return <code className="cp-text-txt-4">{ highlightText(JSON.stringify(value), search) }</code>
        }

        return <span className="cp-text-txt-4">{ highlightText(value + "", search) }</span>
    }

    return (
        <div className="data-grid">
            <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
                <Column style={{ flex: "0 1 auto", overflow: "hidden" }}>
                    { title && typeof title === "object" ? title :
                    <h3 className="cp-text-2xl cp-fw-600" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ title }</h3> }
                </Column>
                <Column style={{ flex: "1 1 auto", overflow: "hidden", maxWidth: "250px" }}>
                    <input
                        type="search"
                        placeholder="Search..."
                        value={search}
                        onChange={ e => handleSearchChange(e.target.value) }
                    />
                </Column>
                <Column style={{ alignItems: "end", flex: "0 0 auto" }}>
                    <MenuButton
                        tabIndex={0}
                        menuPositionY="bottom"
                        menuPositionX="right"
                        menu={
                        <Menu>
                            <MenuItemGroupHeader title="Visible Columns" />
                            { props.columns.map((col, i) => {
                                return (
                                    <label key={i} className="cp-menu-item">
                                        <CheckBox
                                            checked={!!columnVisibility[col.propName!]}
                                            onChange={e => setColumnVisibility({ ...columnVisibility, [col.propName!]: e.target.checked })}
                                            className="mr-1"
                                        />{col.label || col.propName}
                                    </label>
                                )
                            }) }
                        </Menu>
                    }>
                        <CogIcon size="1.4em" />
                    </MenuButton>
                </Column>
            </Row>
            { error && <Alert variant="danger" className="my-1">{ error + "" }</Alert> }
            { loading && <Loader className="data-grid-loader" /> }
            <div className="data-grid-wrapper" ref={wrapperRef}>
                <table
                    style={{ width: tableWidth !== undefined ? `${tableWidth}px` : undefined }}
                    className={ classList({ "data-grid-table": true, "widths-locked": widthsLocked, [props.className!]: true })}>
                    { renderColumnGroup() }
                    { renderDataGridHeader() }
                    { renderDataGridBody() }
                </table>
            </div>
            <div className="data-grid-footer-section">
            { shouldHavePagination && <>
                <span className="color-window-text-soft small">
                    <span className="d-none d-m-flex">
                        Rows { offset + 1 } to { offset + rows.length } of {count.toLocaleString() ?? "unknown" }
                    </span>
                </span>
                <Pagination
                    offset={offset}
                    limit={limit}
                    total={count}
                    onChange={offset => props.onPaginationChange!(offset)}
                />
                <span className="color-window-text-soft small">
                    <span className="d-none d-m-flex">
                        Page { 1 + offset/limit } of { totalPages.toLocaleString() }
                    </span>
                </span>
            </> }
            { !rows.length && !loading && <div className="cp-text-amber cp-p-3" style={{ margin: "auto", textAlign: "center" }}>No records found</div>}
            </div>
        </div>
    )
}
