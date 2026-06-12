import { classList } from "../../utils"
import "./Loader.scss"


export function Loader({ className, msg, centered }: { className?: string, msg?: string, centered?: boolean }) {
    return (
        <span className={ classList({ [className!]: true, "spinner-wrap": true })} style={
            centered ? {
                flex: 1,
                alignContent: "center",
                textAlign: "center"
            } : undefined }>
            { !!msg ? <><span className="spinner" /> {msg}</> : <span className="spinner" /> }
        </span> 
    )
}