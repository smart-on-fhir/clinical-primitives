import { ConditionListWrapper }     from "./Condition/ConditionList";
import { ImmunizationListWrapper }  from "./Immunization/ImmunizationList";
import { Column }                   from "./Column";
import { Row }                      from "./Row";
import { MedicationListWrapper }    from "./Medication/MedicationList";
import { ObservationCardWrapper, ObservationCardWrapperProps }   from "./Observation";
import { ObservationsPanelWrapper, ObservationsPanelWrapperProps } from "./Observation/ObservationsPanel";
import { LabTrendPanel }            from "../library";
import { EventFeedWrapper, type RangeOption } from "./EventFeed";
import { LabTrendPanelProps } from "./Observation/LabTrendPanel";
import { Chart } from "./Chart";
import type { ChartProps, ChartType } from "./Chart";
import { Component, type ReactNode } from "react";

class ComponentErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
    state = { error: null };
    static getDerivedStateFromError(e: unknown) {
        return { error: String(e) };
    }
    render() {
        if (this.state.error) {
            return <div className="alert alert-danger">Error rendering component: {this.state.error}</div>;
        }
        return this.props.children;
    }
}


type Instruction = {
    type: string;
    [key: string]: any;
};

type TextComponentParsedProps = {
    type: "text";
    content: string;
}

interface ObservationCardComponentParsedProps extends ObservationCardWrapperProps {
    type: "observation_card";
}

interface ObservationPanelComponentParsedProps extends ObservationsPanelWrapperProps {
    type: "observation_panel";
}

interface LabTrendPanelComponentParsedProps extends LabTrendPanelProps {
    type: "lab_trend_panel";
}

interface ChartComponentParsedProps extends Omit<ChartProps, 'type'> {
    type: "chart";
    chartType: ChartType;
}

interface EventFeedComponentParsedProps {
    type: "event_feed";
    title?: string;
    rangeOptions?: RangeOption[];
    defaultRange?: string;
    includeTypes?: string[];
    maxHeight?: number | string;
    minHeight?: number | string;
    resources: Record<string, object[]>;
}

type ListComponentParsedProps = {
    type: "medication_list" | "condition_list" | "immunization_list";
    title?: string;
};

interface ColumnComponentParsedProps {
    type: "column";
    children: Instruction | Instruction[];
    className?: string;
}

interface RowComponentParsedProps {
    type: "row";
    children: Instruction | Instruction[];
    className?: string;
}

type StaticComponentParsedProps =
    TextComponentParsedProps |
    ObservationCardComponentParsedProps |
    ObservationPanelComponentParsedProps |
    LabTrendPanelComponentParsedProps |
    ChartComponentParsedProps |
    EventFeedComponentParsedProps |
    ListComponentParsedProps |
    ColumnComponentParsedProps |
    RowComponentParsedProps;

/**
 * Strip props that cause React DOM errors when instructions come from an LLM:
 * - empty-string keys (invalid attribute names)
 * - `style` as a string (React requires an object)
 * - `className` as a non-string
 * - event handler props (LLM sometimes sends them as strings)
 */
function sanitizeProps<T extends Record<string, unknown>>(props: T): Partial<T> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) {
        if (!key) continue;
        if (key === 'style' && typeof value === 'string') continue;
        if (key === 'className' && typeof value !== 'string') continue;
        if (/^on[A-Z]/.test(key) && typeof value !== 'function') continue;
        result[key] = value;
    }
    return result as Partial<T>;
}

export function StaticComponent({ instruction }: { instruction: string | Instruction | Instruction[] }) {
    let parsed: StaticComponentParsedProps;
    try {
        parsed = typeof instruction === "string" ? JSON.parse(instruction) : instruction;
        if (!parsed || typeof parsed !== "object") {
            throw new Error("Instruction is not an object");
        }
    } catch (e) {
        return <div className="alert alert-danger">Invalid render instruction: {e + ""}</div>;
    }

    if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => <StaticComponent key={idx} instruction={item} />);
    }

    try {
        switch (parsed.type) {
            case "text":
                return parsed.content + "";
            case "observation_card": {
                const { type: _, ...props } = parsed;
                return <ComponentErrorBoundary><ObservationCardWrapper {...sanitizeProps(props) as typeof props} /></ComponentErrorBoundary>;
            }
            case "observation_panel": {
                const { type: _, ...props } = parsed;
                return <ComponentErrorBoundary><ObservationsPanelWrapper {...sanitizeProps(props) as typeof props} /></ComponentErrorBoundary>;
            }
            case "lab_trend_panel": {
                const { type: _, ...props } = parsed;
                return <ComponentErrorBoundary><LabTrendPanel {...sanitizeProps(props) as typeof props} /></ComponentErrorBoundary>;
            }
            case "chart": {
                const { type: _, chartType, ...props } = parsed;
                return <ComponentErrorBoundary><Chart type={chartType} {...sanitizeProps(props) as typeof props} /></ComponentErrorBoundary>;
            }
            case "medication_list":
                return <ComponentErrorBoundary><MedicationListWrapper title={parsed.title} /></ComponentErrorBoundary>;
            case "condition_list":
                return <ComponentErrorBoundary><ConditionListWrapper title={parsed.title} /></ComponentErrorBoundary>;
            case "immunization_list":
                return <ComponentErrorBoundary><ImmunizationListWrapper title={parsed.title} /></ComponentErrorBoundary>;
            case "event_feed": {
                const { type: _, ...props } = parsed;
                return <ComponentErrorBoundary><EventFeedWrapper {...sanitizeProps(props) as any} /></ComponentErrorBoundary>;
            }
            case "column": {
                const { type: _, children, ...columnRest } = parsed;
                return <ComponentErrorBoundary><Column {...sanitizeProps(columnRest)}><StaticComponent instruction={children} /></Column></ComponentErrorBoundary>;
            }
            case "row": {
                const { type: _, children, ...rowRest } = parsed;
                return <ComponentErrorBoundary><Row {...sanitizeProps(rowRest)}><StaticComponent instruction={children} /></Row></ComponentErrorBoundary>;
            }
            default:
                return <div className="cp-color-red">Unhandled type: {(parsed as Instruction).type}</div>;
        }
    } catch (e) {
        return <div className="alert alert-danger">Error rendering instruction: {e + ""}</div>;
    }
}