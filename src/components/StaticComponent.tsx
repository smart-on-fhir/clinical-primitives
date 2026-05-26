import { ConditionListWrapper }     from "./Condition/ConditionList";
import { ImmunizationListWrapper }  from "./Immunization/ImmunizationList";
import { Column }                   from "./Column";
import { Row }                      from "./Row";
import { MedicationListWrapper }    from "./Medication/MedicationList";
import { ObservationCardWrapper, ObservationCardWrapperProps }   from "./Observation";
import { ObservationsPanelWrapper, ObservationsPanelWrapperProps } from "./Observation/ObservationsPanel";
import { LabTrendPanel }            from "../library";
import { LabTrendPanelProps } from "./Observation/LabTrendPanel";
import { Chart } from "./Chart";
import type { ChartProps, ChartType } from "./Chart";


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
    ListComponentParsedProps |
    ColumnComponentParsedProps |
    RowComponentParsedProps;

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

    switch (parsed.type) {
        case "text":
            return parsed.content + "";
        case "observation_card": {
            const { type: _, ...props } = parsed;
            return <ObservationCardWrapper {...props} />;
        }
        case "observation_panel": {
            const { type: _, ...props } = parsed;
            return <ObservationsPanelWrapper {...props} />;
        }
        case "lab_trend_panel": {
            const { type: _, ...props } = parsed;
            return <LabTrendPanel {...props} />;
        }
        case "chart": {
            const { type: _, chartType, ...props } = parsed;
            return <Chart type={chartType} {...props} />;
        }
        case "medication_list":
            return <MedicationListWrapper title={parsed.title} />;
        case "condition_list":
            return <ConditionListWrapper title={parsed.title} />;
        case "immunization_list":
            return <ImmunizationListWrapper title={parsed.title} />;
        case "column": {
            const { type: _, children, ...columnRest } = parsed;
            return <Column {...columnRest}><StaticComponent instruction={children} /></Column>;
        }
        case "row": {
            const { type: _, children, ...rowRest } = parsed;
            return <Row {...rowRest}><StaticComponent instruction={children} /></Row>;
        }
        default:
            return <div className="cp-color-red">Unhandled type: {(parsed as Instruction).type}</div>;
    }
}