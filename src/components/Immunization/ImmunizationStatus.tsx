const LABELS: Record<string, string> = {
    'completed'       : 'Completed',
    'not-done'        : 'Not done',
    'entered-in-error': 'Entered in error',
};

export default function ImmunizationStatus({ status }: { status: string }) {
    if (!status) return null;
    const label = LABELS[status] ?? (status.charAt(0).toUpperCase() + status.slice(1));
    return <span title={status}>{label}</span>;
}
