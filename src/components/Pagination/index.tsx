import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button }                    from "../Button/Button"
import "./Pagination.scss"


export function Pagination({
    offset,
    limit,
    total,
    onChange
}: {
    offset  : number
    limit   : number
    total   : number
    onChange: (offset: number) => void
}) {

    const curPageIndex = Math.floor(offset / limit)
    const totalPages   = Math.ceil(total / limit)

    if (totalPages < 2) {
        return null
    }

    return (
        <div className="cp-pagination">
            <div style={{ flex: "1 1 auto" }} />
            <Button
                type="button"
                variant="neutral"
                virtual
                disabled={ offset < limit }
                // className="btn btn-virtual col col-0 center px-1"
                onClick={() => onChange(offset - limit)}
            ><ChevronLeft /></Button>

            {/* <div style={{ flex: "1 1 auto" }} /> */}

            {[curPageIndex - 2, curPageIndex - 1].filter(i => i >= 0).map(i => (
                <Button key={i} type="button" variant="neutral" virtual onClick={() => onChange(limit * i)}>{ i + 1 }</Button>
            ))}

            <Button type="button" variant="link" hard>{curPageIndex + 1}</Button>

            {[curPageIndex + 1, curPageIndex + 2].filter(i => i < totalPages).map(i => (
                <Button key={i} type="button" variant="neutral" virtual onClick={() => onChange(limit * i)}>{ i + 1 }</Button>
            ))}

            {/* <div style={{ flex: "1 1 auto" }} /> */}

            { offset + limit < total && <Button
                type="button"
                variant="neutral"
                virtual
                // className="btn btn-virtual col col-0 center px-1"
                onClick={() => onChange(offset + limit)}
                disabled={ offset + limit >= total }
            >
                <ChevronRight />
            </Button> }
            <div style={{ flex: "1 1 auto" }} />
        </div>
    )
}