import { normalizeMedName } from "../../lib/Medication";

export default function MedicationName({ name }: { name: string }) {
    if (!name) return null;
    return <span title={name}>{normalizeMedName(name)}</span>;
}