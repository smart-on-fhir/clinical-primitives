import { ReactNode }   from "react"
import { Button }      from "../.."
import { ButtonProps } from "../Button/Button"
import "./RadioButton.scss"


interface RadioButtonProps extends Omit<ButtonProps, 'value' | 'onChange'> {
    value: string | number | boolean
    onChange: (v: string | number | boolean) => void
    options: {
        value: string | number | boolean
        label: string | ReactNode
    }[],
    activeClassName?: string
}

export function RadioButton({
    value,
    options,
    onChange,
    activeClassName = "btn-window-text-soft",
    ...btnProps
}: RadioButtonProps) {
    return (
        <div className="radio-button">
            { options.map((o, i) => (
                <Button
                    key={i}
                    aria-checked={o.value === value}
                    {...btnProps}
                    onClick={() => onChange(o.value)}
                >{ o.label }</Button>
            )) }
        </div>
    )
}