import { ReactNode }   from "react"
import { Button }      from "../.."
import { ButtonProps } from "../Button/Button"
import "./RadioButton.scss"


interface RadioButtonProps extends Omit<ButtonProps, 'value' | 'onChange'> {
    /**
     * The selected option's value. A value matching no option leaves the group
     * with nothing selected, which is the honest state for a control whose
     * selection is derived from something the user can move off — a chart's
     * visible range, say.
     */
    value: string | number | boolean
    onChange: (v: string | number | boolean) => void
    options: {
        value: string | number | boolean
        label: string | ReactNode

        /** Hover text for this option alone. Falls back to the group's. */
        title?: string

        /**
         * Offered but not selectable — an option that exists in the set but has
         * nothing to select right now. Shown rather than dropped, so the group
         * does not change width as options come and go.
         */
        disabled?: boolean
    }[],

    /**
     * Extra class for the selected option, for a group whose selected state
     * needs to look like more than the variant's own pressed colors.
     */
    activeClassName?: string
}

export function RadioButton({
    value,
    options,
    onChange,
    // No default. It used to name a class that exists nowhere in the library,
    // and was never applied to anything either — so the prop did nothing at all,
    // and starting to apply it would have put a phantom class on every group.
    activeClassName,
    ...btnProps
}: RadioButtonProps) {
    return (
        <div className="radio-button">
            { options.map((o, i) => {
                const checked = o.value === value;

                return (
                    <Button
                        key={i}
                        {...btnProps}
                        // After the spread, all of them: these say what this
                        // option is, and a group-wide prop cannot answer that.
                        aria-checked={checked}
                        title={o.title ?? btnProps.title}
                        disabled={o.disabled ?? btnProps.disabled}
                        className={[btnProps.className, checked ? activeClassName : null]
                            .filter(Boolean).join(" ") || undefined}
                        onClick={() => onChange(o.value)}
                    >{ o.label }</Button>
                );
            }) }
        </div>
    )
}