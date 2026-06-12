import { useEffect, useRef } from "react"


interface CheckBoxProps extends React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> {
    indeterminate?: boolean
}

export function CheckBox(props: CheckBoxProps = {}) {
    const ref = useRef(null)
    const { indeterminate, ...rest } = props
    useEffect(() => {
        if (indeterminate !== undefined && ref.current) {
            // @ts-ignore
            ref.current.indeterminate = indeterminate
        }
    }, [indeterminate])
    return <input { ...rest } type="checkbox" ref={ref} />
}