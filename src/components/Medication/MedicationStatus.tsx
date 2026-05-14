export default function MedicationStatus({ status }: { status: string }) {
    let s = String(status || '').toLowerCase().trim();
    if (!s) return null;
    s = s.replace(/\s+/g, '-').replace(/\W+/g, ' ');
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return <span title={status}>{s}</span>;
}