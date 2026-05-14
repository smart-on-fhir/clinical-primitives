
export default function ConditionStatus({ status }: { status: string }) {
    if (!status) return null;
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return <span title={status}>{label}</span>;
}
