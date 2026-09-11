// @ts-nocheck
import { ReactNode } from "react"
import { EditorOptions } from "../Editor"

export type DataGridColumnDataType = "string" | "number" | "boolean" | "json" | "date" | "id"

export interface DataGridColumn {
    propName    ?: string
    dataType    ?: DataGridColumnDataType
    label       ?: string
    sortProp    ?: string
    renderHeader?: () => React.ReactNode
    renderCell  ?: (row: any, all: any[]) => React.ReactNode
    tdProps     ?: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableDataCellElement>
    thProps     ?: React.DetailedHTMLProps<React.TdHTMLAttributes<HTMLTableDataCellElement>, HTMLTableHeaderCellElement>

    /**
     * If set to false, the column will not be initially included in the table,
     * but it will still be available in the filters UI
     */
    visible?: boolean

    nullable?: boolean

    editor?: EditorOptions

    /**
     * Initial column width in pixels. If omitted, the browser distributes the
     * available width automatically. Ignored once the user resizes the column.
     */
    width?: number

    /**
     * Minimum width in pixels the user can resize this column down to.
     * Defaults to 60.
     */
    minWidth?: number
}

export interface Filter {
    propName: string
    operator: string
    value  ?: string | number | boolean | Date
}

export interface DataGridProps {

    /**
     * The title of the grid
     */
    title?: string | ReactNode
    
    /**
     * Space separated list of one or more CSS classes
     */
    className?: string
    
    columns: DataGridColumn[]
    
    rows?: any[]
    
    count?: number

    limit?: number

    /**
     * The name of the column property acting as unique identifier for each
     * record. This is used along with `onSelectionChange` to enable selection
     * checkboxes
     */
    identity?: string

    /**
     * List of IDs that should be rendered as selected
     */
    selection?: (string | number)[]

    /**
     * If this callback is provided along with the identity, then the selection
     * checkboxes will be shown
     */
    onSelectionChange?: (selection: (string | number)[]) => void

    /**
     * The parent component tells us if our current dataset happens to be sorted
     * by any of its columns. Defaults to `""`.
     */
    sortColumn?: string

    /**
     * The direction in which the data is currently sorted (does not matter if
     * sortColumn is not set).
     */
    sortDir?: "asc"|"desc"

    /**
     * If provided, the columns will be sortable
     */
    onSortChange?: (sortColumn: string, sortDir: "asc"|"desc") => void

    /**
     * The parent component tells us where the data window we currently have is
     * starting. If not provided we assume this is the beginning of the data (on
     * the first page), therefore the default is `0`.
     */
    offset?: number,

    /**
     * If this callback is provided along with `count` greater than `0`, a
     * pagination will be rendered and `onPaginationChange` will be called when
     * users click on pagination buttons.
     */
    onPaginationChange?: (offset: number, limit?: number) => void

    filters?: Filter[]

    onFilterChange?: (filters: Filter[]) => void

    /**
     * Current search text. Matches are highlighted in the rendered cells;
     * filtering the rows for it is the caller's responsibility (via
     * `onSearchChange`), the same way sorting and pagination work.
     */
    search?: string

    onSearchChange?: (search: string) => void

    loading?: boolean

    error?: Error | string | null

    onNavigate?: (row: any, rowIndex: number) => void
}