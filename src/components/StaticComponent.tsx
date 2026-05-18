import { ConditionListWrapper }     from "./Condition/ConditionList";
import { ImmunizationListWrapper }  from "./Immunization/ImmunizationList";
import { Column }                   from "./Column";
import { Row }                      from "./Row";
import { MedicationListWrapper }    from "./Medication/MedicationList";
import { ObservationCardWrapper }   from "./Observation";
import { ObservationsPanelWrapper } from "./Observation/ObservationsPanel";
import { LabTrendPanel }            from "../library";


type Instruction = {
    type: string;
    [key: string]: any;
};

export function StaticComponent({ instruction }: { instruction: string | Instruction }) {
    let parsed;
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

    const { type, ...rest } = parsed;

    switch (type) {
        case "text":
            return rest.content + "";
        case "observation_card":
            return <ObservationCardWrapper {...rest} />;
        case "observation_panel":
            return <ObservationsPanelWrapper {...rest} />;
        case "lab_trend_panel":
            return <LabTrendPanel {...rest} />;
        case "medication_list":
            return <MedicationListWrapper {...rest} />;
        case "condition_list":
            return <ConditionListWrapper {...rest} />;
        case "immunization_list":
            return <ImmunizationListWrapper {...rest} />;
        case "column": {
            const { children, ...columnRest } = rest;
            return <Column {...columnRest}><StaticComponent instruction={children} /></Column>;
        }
        case "row": {
            const { children, ...rowRest } = rest;
            return <Row {...rowRest}><StaticComponent instruction={children} /></Row>;
        }
        default:
            return <div className="cp-color-red">Unhandled type: {type}</div>;
    }
}